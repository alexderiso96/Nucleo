export const runtime = 'nodejs';

import { createClient } from '@/lib/supabaseServer';
import { parseNucleoJson } from '@/lib/json-parser';
import { categorizeDescription, type MerchantRule } from '@/lib/categorize';
import { categorizeWithAI } from '@/lib/ai-categorize';

export interface SyncResult {
  skipped: boolean;
  files: number;
  imported: number;
  duplicates: number;
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
  if (!user) return { skipped: true, files: 0, imported: 0, duplicates: 0 };

  const { data: profile } = await supabase
    .from('profiles')
    .select('drive_refresh_token, drive_folder_id, drive_last_synced_at')
    .eq('id', user.id)
    .single();

  if (!profile?.drive_refresh_token || !profile?.drive_folder_id)
    return { skipped: true, files: 0, imported: 0, duplicates: 0 };

  const accessToken = await getAccessToken(profile.drive_refresh_token);
  if (!accessToken) return { skipped: true, files: 0, imported: 0, duplicates: 0 };

  // Solo file JSON modificati dopo l'ultima sync (sync incrementale)
  const sinceClause = profile.drive_last_synced_at
    ? ` and modifiedTime > '${profile.drive_last_synced_at}'`
    : '';
  const q = `'${profile.drive_folder_id}' in parents and mimeType='application/json' and trashed=false${sinceClause}`;

  const listRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const listData = await listRes.json() as { files?: { id: string; name: string }[] };
  const files = listData.files ?? [];

  // Aggiorna lastSyncedAt anche se non ci sono file nuovi
  const now = new Date().toISOString();

  if (files.length === 0) {
    await supabase.from('profiles').update({ drive_last_synced_at: now }).eq('id', user.id);
    return { skipped: false, files: 0, imported: 0, duplicates: 0 };
  }

  const { data: rulesData } = await supabase
    .from('merchant_rules')
    .select('pattern, category')
    .eq('user_id', user.id);
  const merchantRules: MerchantRule[] = rulesData ?? [];

  let totalImported = 0;
  let totalDuplicates = 0;

  for (const file of files) {
    const fileRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!fileRes.ok) continue;

    const text = await fileRes.text();
    const { valid } = parseNucleoJson(text);
    if (valid.length === 0) continue;

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
    for (const row of valid) {
      const key = `${row.date}|${row.amount.toFixed(2)}`;
      if (existingKeys.has(key)) {
        totalDuplicates++;
      } else {
        toInsert.push(row);
        existingKeys.add(key);
      }
    }

    if (toInsert.length > 0) {
      // Pre-categorizzazione; batch AI per le righe a bassa confidence
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
        const aiRes = await categorizeWithAI(descs).catch(() => null);
        if (aiRes) {
          for (let k = 0; k < lowIdxs.length; k++) {
            preCat[lowIdxs[k]] = { category: aiRes[k], confidence: 'low' };
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
      }
    }
  }

  await supabase.from('profiles').update({ drive_last_synced_at: now }).eq('id', user.id);

  return { skipped: false, files: files.length, imported: totalImported, duplicates: totalDuplicates };
}
