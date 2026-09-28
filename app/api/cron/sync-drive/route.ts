export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { refreshAccessToken, listNewPdfs, downloadFile } from '@/lib/googleDrive';
import { extractPayslip } from '@/lib/payslip-extract';

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
  const results: Array<{ userId: string; files: number; processed: number; error?: string }> = [];

  for (const profile of profiles) {
    const userId = profile.id as string;
    try {
      const accessToken = await refreshAccessToken(profile.drive_refresh_token as string);

      const files = await listNewPdfs(
        accessToken,
        profile.drive_folder_id as string | null,
        profile.drive_last_synced_at as string | null,
      );
      console.log(`[sync-drive] user ${userId}: ${files.length} new files`);

      let processed = 0;
      for (const file of files) {
        try {
          const buffer = await downloadFile(accessToken, file.id);
          const fields = await extractPayslip(buffer);

          if (fields.confidence === 'high' && fields.periodMonth && fields.grossAmount != null && fields.netAmount != null) {
            const { error: upsertErr } = await supabase.from('payslips').upsert({
              user_id:                userId,
              period_month:           fields.periodMonth,
              gross_amount:           fields.grossAmount,
              net_amount:             fields.netAmount,
              irpef:                  fields.irpef ?? 0,
              inps_contributions:     fields.inpsContributions ?? 0,
              regional_municipal_tax: fields.regionalMunicipalTax ?? 0,
              overtime_hours:         fields.overtimeHours ?? 0,
              overtime_amount:        fields.overtimeAmount ?? 0,
              meal_vouchers:          fields.mealVouchers ?? 0,
              tfr_accrued_this_period: fields.tfrAccruedPeriod ?? 0,
              tfr_total_accrued:      fields.tfrTotal ?? 0,
              source:                 'drive',
              source_file_url:        file.webViewLink ?? null,
            }, { onConflict: 'user_id,period_month', ignoreDuplicates: true });

            if (!upsertErr) processed++;
            else console.error(`[sync-drive] upsert error for ${file.name}:`, upsertErr.message);
          }
        } catch (fileErr) {
          console.error(`[sync-drive] error processing ${file.name}:`, fileErr instanceof Error ? fileErr.message : fileErr);
        }
      }

      await supabase
        .from('profiles')
        .update({ drive_last_synced_at: new Date().toISOString() })
        .eq('id', userId);

      results.push({ userId, files: files.length, processed });
    } catch (userErr) {
      const msg = userErr instanceof Error ? userErr.message : String(userErr);
      console.error(`[sync-drive] error for user ${userId}:`, msg);
      results.push({ userId, files: 0, processed: 0, error: msg });
    }
  }

  console.log('[sync-drive] done', results);
  return NextResponse.json({ users: results.length, results });
}
