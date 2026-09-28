export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabaseServer';

export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const uid = user.id;

  await supabase.from('expenses').delete().eq('user_id', uid);
  await supabase.from('payslips').delete().eq('user_id', uid);
  await supabase.from('merchant_rules').delete().eq('user_id', uid);
  await supabase.from('csv_mappings').delete().eq('user_id', uid);
  await supabase.from('household_invites').delete().eq('created_by', uid);

  // Cancella il nucleo familiare solo se sei l'unico membro
  const { data: profile } = await supabase
    .from('profiles')
    .select('household_id')
    .eq('id', uid)
    .single();

  if (profile?.household_id) {
    const { count } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('household_id', profile.household_id);

    if (count === 1) {
      await supabase.from('households').delete().eq('id', profile.household_id);
    }
  }

  await supabase
    .from('profiles')
    .update({
      household_id:        null,
      drive_refresh_token: null,
      drive_folder_id:     null,
      drive_last_synced_at: null,
      drive_file_url:      null,
    })
    .eq('id', uid);

  return NextResponse.json({ ok: true });
}
