import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabaseServer';
import { categorizeDescription, type MerchantRule } from '@/lib/categorize';
import { categorizeWithAI, resolveAICategories } from '@/lib/ai-categorize';

interface ImportRow {
  date: string;
  amount: number;
  description: string | null;
  isIncome?: boolean;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let rows: ImportRow[];
  try {
    const body = await request.json() as { rows: ImportRow[] };
    rows = body.rows;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'rows is empty or invalid' }, { status: 400 });
  }

  const dates = rows.map(r => r.date).sort();
  const minDate = dates[0];
  const maxDate = dates[dates.length - 1];

  const [{ data: rulesData }, { data: userCatsData }] = await Promise.all([
    supabase.from('merchant_rules').select('pattern, category').eq('user_id', user.id),
    supabase.from('user_categories').select('value, label').eq('user_id', user.id),
  ]);
  const merchantRules: MerchantRule[] = rulesData ?? [];
  const userCats = (userCatsData ?? []) as { value: string; label: string }[];

  const { data: existing } = await supabase
    .from('expenses')
    .select('expense_date, amount')
    .eq('user_id', user.id)
    .eq('source', 'csv')
    .gte('expense_date', minDate)
    .lte('expense_date', maxDate);

  const existingKeys = new Set<string>(
    (existing ?? []).map(e => `${e.expense_date}|${Number(e.amount).toFixed(2)}`),
  );

  const toInsert: ImportRow[] = [];
  const duplicateRows: ImportRow[] = [];

  for (const row of rows) {
    const key = `${row.date}|${row.amount.toFixed(2)}`;
    if (existingKeys.has(key)) {
      if (!row.isIncome) duplicateRows.push(row);
    } else {
      toInsert.push(row);
      existingKeys.add(key);
    }
  }

  // --- Ricategorizza i duplicati con category = 'altro' o confidence = 'low' ---
  let recategorized = 0;
  console.log(`[import] duplicateRows=${duplicateRows.length} toInsert=${toInsert.length}`);

  if (duplicateRows.length > 0) {
    const dupDates = [...new Set(duplicateRows.map(r => r.date))];
    console.log(`[import] checking ${dupDates.length} date(s) for uncategorized duplicates`);

    // No source filter — cattura spese da qualsiasi provenienza
    const { data: uncatExisting, error: uncatErr } = await supabase
      .from('expenses')
      .select('id, description, expense_date, amount, category, category_confidence')
      .eq('user_id', user.id)
      .in('expense_date', dupDates)
      .or('category.eq.altro,category_confidence.eq.low');

    if (uncatErr) console.error('[import] uncatExisting query error:', uncatErr.message);
    console.log(`[import] uncatExisting (altro/low) count=${uncatExisting?.length ?? 0}`);

    const toRecat = (uncatExisting ?? []).filter(e =>
      duplicateRows.some(r =>
        r.date === e.expense_date &&
        Math.abs(r.amount - Number(e.amount)) < 0.005,
      ),
    );
    console.log(`[import] toRecat (matched to batch) count=${toRecat.length}`);

    // Cap a 50 per evitare timeout Vercel (10s su Hobby)
    const RECAT_BATCH = 50;
    const capped = toRecat.slice(0, RECAT_BATCH);
    if (capped.length < toRecat.length)
      console.log(`[import] toRecat capped to ${RECAT_BATCH} (total=${toRecat.length})`);

    if (capped.length > 0) {
      const descs = capped.map(e => e.description ?? '');
      let aiRes: Awaited<ReturnType<typeof categorizeWithAI>> | null = null;
      try {
        aiRes = await categorizeWithAI(descs, userCats);
        console.log(`[import] AI returned ${aiRes.length} results`);
      } catch (err) {
        console.error('[import] categorizeWithAI error:', err instanceof Error ? err.message : String(err));
      }

      if (aiRes) {
        let resolved: string[] | null = null;
        try {
          resolved = await resolveAICategories(aiRes, user.id);
        } catch (err) {
          console.error('[import] resolveAICategories error:', err instanceof Error ? err.message : String(err));
        }

        if (resolved) {
          for (let k = 0; k < capped.length; k++) {
            const newCat = resolved[k];
            const oldCat = capped[k].category;
            if (newCat !== 'altro' && newCat !== oldCat) {
              const { error: updErr } = await supabase
                .from('expenses')
                .update({ category: newCat, category_confidence: 'ai' })
                .eq('id', capped[k].id);
              if (updErr) {
                console.error(`[import] update error for id=${capped[k].id}:`, updErr.message);
              } else {
                console.log(`[import] recategorized id=${capped[k].id} ${oldCat} → ${newCat}`);
                recategorized++;
              }
            } else {
              console.log(`[import] skipped id=${capped[k].id} (new=${newCat} old=${oldCat})`);
            }
          }
        }
      }
    }
  }

  // --- Pre-categorizzazione + batch AI per le nuove righe ---
  type Categorized = { category: string; confidence: string };
  const preCat: Categorized[] = toInsert.map(row => {
    if (row.isIncome) return { category: 'income', confidence: 'high' };
    return categorizeDescription(row.description, merchantRules);
  });

  const lowConfIdxs = preCat
    .map((c, i) => (c.confidence === 'low' ? i : -1))
    .filter(i => i >= 0);

  if (lowConfIdxs.length > 0) {
    const descs = lowConfIdxs.map(i => toInsert[i].description ?? '');
    const aiResults = await categorizeWithAI(descs, userCats).catch(() => null);
    if (aiResults) {
      const resolved = await resolveAICategories(aiResults, user.id).catch(() => null);
      if (resolved) {
        for (let k = 0; k < lowConfIdxs.length; k++) {
          preCat[lowConfIdxs[k]] = { category: resolved[k], confidence: 'low' };
        }
      }
    }
  }

  // --- Batch insert 100 righe per volta ---
  const BATCH = 100;
  for (let i = 0; i < toInsert.length; i += BATCH) {
    const chunk = toInsert.slice(i, i + BATCH).map((row, j) => {
      const { category, confidence } = preCat[i + j];
      return {
        user_id: user.id,
        amount: row.amount,
        currency: 'EUR',
        category,
        category_confidence: confidence,
        description: row.description,
        expense_date: row.date,
        source: 'csv',
        is_shared: false,
        is_income: row.isIncome ?? false,
      };
    });

    const { error } = await supabase.from('expenses').insert(chunk);
    if (error) return NextResponse.json({ error: 'Insert failed' }, { status: 500 });
  }

  return NextResponse.json({
    imported: toInsert.length,
    duplicates: duplicateRows.length,
    recategorized,
    total: rows.length,
  });
}
