import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabaseServer';

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

async function getHouseholdId(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('profiles')
    .select('household_id')
    .eq('id', userId)
    .single();
  return data?.household_id ?? null;
}

async function createInvite(
  supabase: Awaited<ReturnType<typeof createClient>>,
  householdId: string,
  userId: string,
): Promise<{ code: string; expiresAt: string }> {
  const code = generateCode();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await supabase
    .from('household_invites')
    .insert({ household_id: householdId, code, created_by: userId, expires_at: expiresAt });
  return { code, expiresAt };
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const householdId = await getHouseholdId(supabase, user.id);
  if (!householdId) return NextResponse.json({ error: 'Nessun nucleo familiare' }, { status: 404 });

  const now = new Date().toISOString();
  const { data: existing } = await supabase
    .from('household_invites')
    .select('code, expires_at')
    .eq('household_id', householdId)
    .is('used_at', null)
    .gt('expires_at', now)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ code: existing.code, expiresAt: existing.expires_at });
  }

  const invite = await createInvite(supabase, householdId, user.id);
  return NextResponse.json(invite);
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const householdId = await getHouseholdId(supabase, user.id);
  if (!householdId) return NextResponse.json({ error: 'Nessun nucleo familiare' }, { status: 404 });

  // Invalida tutti gli inviti esistenti non ancora usati
  await supabase
    .from('household_invites')
    .update({ expires_at: new Date().toISOString() })
    .eq('household_id', householdId)
    .is('used_at', null);

  const invite = await createInvite(supabase, householdId, user.id);
  return NextResponse.json(invite);
}
