export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import Papa from 'papaparse';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { refreshAccessToken, listNewFiles, downloadFile } from '@/lib/googleDrive';
import { decodeBuffer, headersFingerprint, parseRows, type ColumnMap, type ParsedRow } from '@/lib/csv-parser';
import { parseXlsxBuffer } from '@/lib/xlsx-parser';
import { categorizeDescription, type MerchantRule } from '@/lib/categorize';

type OkRow = Extract<ParsedRow, { ok: true }>;

export async function POST(request: NextRequest) {
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, drive_refresh_token, drive_folder_id, drive_last_synced_at')
    .not('drive_refresh_token', 'is', null);

  if (error || !profiles) {
    console.error('[sync-drive] failed to load profiles:', error?.message);
    return NextResponse.json({ error: 'DB error' }, { status: 500 });
  }

  console.log(`[sync-drive] processing ${profiles.length} users`);
  const results: Array<{ userId: string; files: number; imported: number; error?: string }> = [];

  for (const profile of profiles) {
    const userId = profile.id as string;
    try {
      const accessToken = await refreshAccessToken(profile.drive_refresh_token as string);
      const files = await listNewFiles(
        accessToken,
        profile.drive_folder_id as string | null,
        profile.drive_last_synced_at as string | null,
      );
      console.log(`[sync-drive] user ${userId}: ${files.length} files found`);

      let totalImported = 0;

      for (const file of files) {
        try {
          const buffer = await downloadFile(accessToken, file.id);
          const name = file.name.toLowerCase();
          const isXlsx = name.endsWith('.xlsx') || name.endsWith('.xls');

          let headers: string[];
          let records: Record<string, string>[];

          if (isXlsx) {
            ({ headers, records } = await parseXlsxBuffer(buffer));
          } else {
            const { text } = decodeBuffer(buffer);
            const parsed = Papa.parse<Record<string, string>>(text, {
              header: true,
              skipEmptyLines: 'greedy',
            });
            headers = parsed.meta.fields ?? [];
            records = parsed.data;
          }

          if (!headers.length || !records.length) continue;

          // Look up saved column mapping for this file's header layout
          const fp = headersFingerprint(headers);
          const { data: mappingRow } = await supabase
            .from('csv_mappings')
            .select('column_map')
            .eq('user_id', userId)
            .eq('headers_fingerprint', fp)
            .maybeSingle();

          if (!mappingRow?.column_map) {
            console.log(`[sync-drive] no saved mapping for "${file.name}", skipping`);
            continue;
          }

          const columnMap = mappingRow.column_map as ColumnMap;
          const rows = parseRows(records, columnMap).filter((r): r is OkRow => r.ok);
          if (!rows.length) continue;

          const dates = rows.map(r => r.date).sort();
          const minDate = dates[0];
          const maxDate = dates[dates.length - 1];

          // Dedup: fetch existing expenses in the same date range
          const { data: existing } = await supabase
            .from('expenses')
            .select('expense_date, amount')
            .eq('user_id', userId)
            .gte('expense_date', minDate)
            .lte('expense_date', maxDate);

          const seen = new Set<string>(
            (existing ?? []).map(e => `${e.expense_date}|${Number(e.amount).toFixed(2)}`),
          );

          const { data: rulesData } = await supabase
            .from('merchant_rules')
            .select('pattern, category')
            .eq('user_id', userId);
          const merchantRules: MerchantRule[] = rulesData ?? [];

          const toInsert = rows.filter(r => {
            const key = `${r.date}|${r.amount.toFixed(2)}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });

          if (!toInsert.length) continue;

          const chunk = toInsert.map(r => {
            const { category, confidence } = categorizeDescription(r.description, merchantRules);
            return {
              user_id:             userId,
              amount:              r.amount,
              currency:            'EUR',
              category,
              category_confidence: confidence,
              description:         r.description,
              expense_date:        r.date,
              source:              'drive',
              is_shared:           false,
            };
          });

          const { error: insertErr } = await supabase.from('expenses').insert(chunk);
          if (!insertErr) {
            totalImported += chunk.length;
            console.log(`[sync-drive] user ${userId}: imported ${chunk.length} from "${file.name}"`);
          } else {
            console.error(`[sync-drive] insert error for "${file.name}":`, insertErr.message);
          }
        } catch (fileErr) {
          console.error(`[sync-drive] error on "${file.name}":`, fileErr instanceof Error ? fileErr.message : fileErr);
        }
      }

      await supabase
        .from('profiles')
        .update({ drive_last_synced_at: new Date().toISOString() })
        .eq('id', userId);

      results.push({ userId, files: files.length, imported: totalImported });
    } catch (userErr) {
      const msg = userErr instanceof Error ? userErr.message : String(userErr);
      console.error(`[sync-drive] error for user ${userId}:`, msg);
      results.push({ userId, files: 0, imported: 0, error: msg });
    }
  }

  console.log('[sync-drive] done', results);
  return NextResponse.json({ users: results.length, results });
}
