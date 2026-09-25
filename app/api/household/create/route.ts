import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabaseServer';

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('household_id')
    .eq('id', user.id)
    .single();

  if (profile?.household_id) {
    return NextResponse.json({ error: 'Hai già un nucleo familiare' }, { status: 409 });
  }

  const { data: household, error: householdErr } = await supabase
    .from('households')
    .insert({ name: 'La mia famiglia' })
    .select('id')
    .single();

  if (householdErr || !household) {
    console.error('[household/create] households insert error:', householdErr?.code, householdErr?.message);
    return NextResponse.json({ error: 'Errore nella creazione del nucleo' }, { status: 500 });
  }
  console.log('[household/create] household created:', household.id);

  const { error: profileErr } = await supabase
    .from('profiles')
    .update({ household_id: household.id })
    .eq('id', user.id);

  if (profileErr) {
    console.error('[household/create] profiles update error:', profileErr?.code, profileErr?.message);
    return NextResponse.json({ error: 'Errore aggiornamento profilo' }, { status: 500 });
  }
  console.log('[household/create] profile updated');

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const code = generateCode();

  const { error: inviteErr } = await supabase
    .from('household_invites')
    .insert({ household_id: household.id, code, created_by: user.id, expires_at: expiresAt });

  if (inviteErr) {
    console.error('[household/create] invites insert error:', inviteErr?.code, inviteErr?.message);
    return NextResponse.json({ error: 'Errore generazione codice invito' }, { status: 500 });
  }

  return NextResponse.json({ householdId: household.id, inviteCode: code });
}
