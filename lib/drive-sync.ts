export const runtime = 'nodejs';

import { createClient } from '@/lib/supabaseServer';
import { parseNucleoJson } from '@/lib/json-parser';
import { categorizeDescription, type MerchantRule } from '@/lib/categorize';
import { categorizeWithAI, resolveAICategories } from '@/lib/ai-categorize';

export interface SyncResult {
  skipped: boolean;
  files: number;
  imported: number;
  duplicates: number;
  recategorized: number;
}

async function getAccessToken(refreshToken: string): Promise<string | null> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id:     process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type:    'refresh_token',
    }),
  });
  const data = await res.json() as { access_token?: string };
  return data.access_token ?? null;
}

export async function syncDriveForUser(): Promise<SyncResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { skipped: true, files: 0, imported: 0, duplicates: 0, recategorized: 0 };

  const { data: profile } = await supabase
    .from('profiles')
    .select('drive_refresh_token, drive_folder_id, drive_last_synced_at')
    .eq('id', user.id)
    .single();

  // drive_folder_id contiene l'ID del file JSON (riutilizziamo la colonna)
  if (!profile?.drive_refresh_token || !profile?.drive_folder_id)
    return { skipped: true, files: 0, imported: 0, duplicates: 0, recategorized: 0 };

  const accessToken = await getAccessToken(profile.drive_refresh_token);
  if (!accessToken) return { skipped: true, files: 0, imported: 0, duplicates: 0, recategorized: 0 };

  const fileId = profile.drive_folder_id;
  const now = new Date().toISOString();

  // Controlla metadata del file per vedere se è stato modificato dall'ultima sync
  const metaRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,modifiedTime`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!metaRes.ok) {
    console.error('[drive-sync] metadata fetch failed:', metaRes.status);
    return { skipped: true, files: 0, imported: 0, duplicates: 0, recategorized: 0 };
  }
  const meta = await metaRes.json() as { id: string; name: string; modifiedTime: string };
  console.log(`[drive-sync] file="${meta.name}" modifiedTime=${meta.modifiedTime} lastSync=${profile.drive_last_synced_at ?? 'mai'}`);

  // Se il file non è stato modificato dall'ultima sync, salta
  if (
    profile.drive_last_synced_at &&
    new Date(meta.modifiedTime) <= new Date(profile.drive_last_synced_at)
  ) {
    console.log('[drive-sync] file non modificato, skip');
    return { skipped: true, files: 1, imported: 0, duplicates: 0, recategorized: 0 };
  }

  // Scarica il contenuto del file
  const fileRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!fileRes.ok) {
    console.error('[drive-sync] file download failed:', fileRes.status);
    return { skipped: true, files: 0, imported: 0, duplicates: 0, recategorized: 0 };
  }

  const text = await fileRes.text();
  const { valid, errors } = parseNucleoJson(text);
  console.log(`[drive-sync] parsed: valid=${valid.length} errors=${errors.length}`);
  if (valid.length === 0) {
    await supabase.from('profiles').update({ drive_last_synced_at: now }).eq('id', user.id);
    return { skipped: false, files: 1, imported: 0, duplicates: 0, recategorized: 0 };
  }

  const [{ data: rulesData }, { data: userCatsData }] = await Promise.all([
    supabase.from('merchant_rules').select('pattern, category').eq('user_id', user.id),
    supabase.from('user_categories').select('value, label').eq('user_id', user.id),
  ]);
  const merchantRules: MerchantRule[] = rulesData ?? [];
  const userCats = (userCatsData ?? []) as { value: string; label: string }[];

  const dates = valid.map(r => r.date).sort();
  const { data: existing } = await supabase
    .from('expenses')
    .select('expense_date, amount')
    .eq('user_id', user.id)
    .eq('source', 'csv')
    .gte('expense_date', dates[0])
    .lte('expense_date', dates[dates.length - 1]);

  const existingKeys = new Set<string>(
    (existing ?? []).map(e => `${e.expense_date}|${Number(e.amount).toFixed(2)}`),
  );

  const toInsert: typeof valid = [];
  const duplicateRows: typeof valid = [];

  for (const row of valid) {
    const key = `${row.date}|${row.amount.toFixed(2)}`;
    if (existingKeys.has(key)) {
      if (!row.isIncome) duplicateRows.push(row);
    } else {
      toInsert.push(row);
      existingKeys.add(key);
    }
  }

  let totalImported = 0;
  let totalDuplicates = duplicateRows.length;
  let totalRecategorized = 0;

  // --- Ricategorizza i duplicati con category = 'altro' o confidence = 'low' ---
  console.log(`[drive-sync] duplicates=${duplicateRows.length} toInsert=${toInsert.length}`);
  if (duplicateRows.length > 0) {
    const dupDates = [...new Set(duplicateRows.map(r => r.date))];
    const { data: uncatExisting, error: uncatErr } = await supabase
      .from('expenses')
      .select('id, description, expense_date, amount, category, category_confidence')
      .eq('user_id', user.id)
      .in('expense_date', dupDates)
      .or('category.eq.altro,category_confidence.eq.low');

    if (uncatErr) console.error('[drive-sync] uncatExisting error:', uncatErr.message);
    console.log(`[drive-sync] uncatExisting (altro/low) count=${uncatExisting?.length ?? 0}`);

    const toRecat = (uncatExisting ?? []).filter(e =>
      duplicateRows.some(r =>
        r.date === e.expense_date &&
        Math.abs(r.amount - Number(e.amount)) < 0.005,
      ),
    );
    console.log(`[drive-sync] toRecat count=${toRecat.length}`);

    if (toRecat.length > 0) {
      const descs = toRecat.map(e => e.description ?? '');
      let aiRes: Awaited<ReturnType<typeof categorizeWithAI>> | null = null;
      try {
        aiRes = await categorizeWithAI(descs, userCats);
      } catch (err) {
        console.error('[drive-sync] categorizeWithAI error:', err instanceof Error ? err.message : String(err));
      }
      if (aiRes) {
        let resolved: string[] | null = null;
        try {
          resolved = await resolveAICategories(aiRes, user.id);
        } catch (err) {
          console.error('[drive-sync] resolveAICategories error:', err instanceof Error ? err.message : String(err));
        }
        if (resolved) {
          for (let k = 0; k < toRecat.length; k++) {
            const newCat = resolved[k];
            const oldCat = toRecat[k].category;
            if (newCat !== 'altro' && newCat !== oldCat) {
              await supabase
                .from('expenses')
                .update({ category: newCat, category_confidence: 'high' })
                .eq('id', toRecat[k].id);
              totalRecategorized++;
              console.log(`[drive-sync] recategorized id=${toRecat[k].id} ${oldCat} → ${newCat}`);
            }
          }
        }
      }
    }
  }

  // --- Pre-categorizzazione + batch AI per le nuove righe ---
  if (toInsert.length > 0) {
    type CatResult = { category: string; confidence: string };
    const preCat: CatResult[] = toInsert.map(row => {
      if (row.isIncome) return { category: 'income', confidence: 'high' };
      return categorizeDescription(row.description, merchantRules);
    });

    const lowIdxs = preCat
      .map((c, i) => (c.confidence === 'low' ? i : -1))
      .filter(i => i >= 0);

    if (lowIdxs.length > 0) {
      const descs = lowIdxs.map(i => toInsert[i].description ?? '');
      let aiRes: Awaited<ReturnType<typeof categorizeWithAI>> | null = null;
      try {
        aiRes = await categorizeWithAI(descs, userCats);
      } catch (err) {
        console.error('[drive-sync] AI categorize new rows error:', err instanceof Error ? err.message : String(err));
      }
      if (aiRes) {
        try {
          const resolved = await resolveAICategories(aiRes, user.id);
          for (let k = 0; k < lowIdxs.length; k++) {
            preCat[lowIdxs[k]] = { category: resolved[k], confidence: 'low' };
          }
        } catch (err) {
          console.error('[drive-sync] resolveAICategories new rows error:', err instanceof Error ? err.message : String(err));
        }
      }
    }

    const BATCH = 100;
    for (let i = 0; i < toInsert.length; i += BATCH) {
      const chunk = toInsert.slice(i, i + BATCH).map((row, j) => {
        const { category, confidence } = preCat[i + j];
        return {
          user_id:             user.id,
          amount:              row.amount,
          currency:            'EUR',
          category,
          category_confidence: confidence,
          description:         row.description,
          expense_date:        row.date,
          source:              'csv',
          is_shared:           false,
          is_income:           row.isIncome,
        };
      });
      const { error } = await supabase.from('expenses').insert(chunk);
      if (!error) totalImported += chunk.length;
      else console.error('[drive-sync] insert error:', error.message);
    }
  }

  await supabase.from('profiles').update({ drive_last_synced_at: now }).eq('id', user.id);
  console.log(`[drive-sync] done: imported=${totalImported} duplicates=${totalDuplicates} recategorized=${totalRecategorized}`);

  return {
    skipped: false,
    files: 1,
    imported: totalImported,
    duplicates: totalDuplicates,
    recategorized: totalRecategorized,
  };
}
