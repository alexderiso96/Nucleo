import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabaseServer';
import { categorizeDescription, type MerchantRule } from '@/lib/categorize';
import { categorizeWithAI } from '@/lib/ai-categorize';

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

  // Intervallo di date del batch
  const dates = rows.map(r => r.date).sort();
  const minDate = dates[0];
  const maxDate = dates[dates.length - 1];

  // Carica regole merchant dell'utente per la categorizzazione
  const { data: rulesData } = await supabase
    .from('merchant_rules')
    .select('pattern, category')
    .eq('user_id', user.id);
  const merchantRules: MerchantRule[] = rulesData ?? [];

  // Recupera spese CSV esistenti nell'intervallo per deduplicazione
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
  let duplicates = 0;

  for (const row of rows) {
    const key = `${row.date}|${row.amount.toFixed(2)}`;
    if (existingKeys.has(key)) {
      duplicates++;
    } else {
      toInsert.push(row);
      existingKeys.add(key); // previeni duplicati interni al batch stesso
    }
  }

  // Pre-categorizzazione con regole; raccogli le descrizioni a bassa confidence per il batch AI
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
    const aiResults = await categorizeWithAI(descs).catch(() => null);
    if (aiResults) {
      for (let k = 0; k < lowConfIdxs.length; k++) {
        preCat[lowConfIdxs[k]] = { category: aiResults[k], confidence: 'low' };
      }
    }
  }

  // Batch insert a 100 righe per volta
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
    if (error) {
      return NextResponse.json({ error: 'Insert failed' }, { status: 500 });
    }
  }

  return NextResponse.json({
    imported: toInsert.length,
    duplicates,
    total: rows.length,
  });
}
