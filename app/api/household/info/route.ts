import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabaseServer';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('household_id, full_name')
    .eq('id', user.id)
    .single();

  if (!profile?.household_id) {
    return NextResponse.json({
      household: null,
      inviteCode: null,
      inviteExpiresAt: null,
      partnerProfile: null,
    });
  }

  const householdId = profile.household_id;

  const [householdRes, partnersRes, inviteRes] = await Promise.all([
    supabase
      .from('households')
      .select('id, name')
      .eq('id', householdId)
      .single(),
    supabase
      .from('profiles')
      .select('id, full_name')
      .eq('household_id', householdId)
      .neq('id', user.id),
    supabase
      .from('household_invites')
      .select('code, expires_at')
      .eq('household_id', householdId)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const partner = partnersRes.data?.[0] ?? null;

  return NextResponse.json({
    household: householdRes.data ?? null,
    inviteCode: inviteRes.data?.code ?? null,
    inviteExpiresAt: inviteRes.data?.expires_at ?? null,
    partnerProfile: partner ? { id: partner.id, full_name: partner.full_name } : null,
  });
}
