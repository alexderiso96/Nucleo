import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabaseServer';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json() as { code?: string };
  const code = (body.code ?? '').trim().toUpperCase();
  if (!code) return NextResponse.json({ error: 'Codice richiesto' }, { status: 400 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('household_id')
    .eq('id', user.id)
    .single();

  if (profile?.household_id) {
    return NextResponse.json({ error: 'Sei già in un nucleo familiare' }, { status: 409 });
  }

  const now = new Date().toISOString();
  const { data: invite } = await supabase
    .from('household_invites')
    .select('id, household_id, created_by')
    .eq('code', code)
    .is('used_at', null)
    .gt('expires_at', now)
    .maybeSingle();

  if (!invite) {
    return NextResponse.json({ error: 'Codice non valido o scaduto' }, { status: 404 });
  }

  if (invite.created_by === user.id) {
    return NextResponse.json({ error: 'Non puoi unirti al tuo stesso nucleo' }, { status: 400 });
  }

  const { error: profileErr } = await supabase
    .from('profiles')
    .update({ household_id: invite.household_id })
    .eq('id', user.id);

  if (profileErr) {
    return NextResponse.json({ error: 'Errore aggiornamento profilo' }, { status: 500 });
  }

  const { error: inviteErr } = await supabase
    .from('household_invites')
    .update({ used_at: now, used_by: user.id })
    .eq('id', invite.id);

  if (inviteErr) {
    return NextResponse.json({ error: 'Errore aggiornamento invito' }, { status: 500 });
  }

  const { data: household } = await supabase
    .from('households')
    .select('id, name')
    .eq('id', invite.household_id)
    .single();

  return NextResponse.json({
    householdId: invite.household_id,
    householdName: household?.name ?? 'La mia famiglia',
  });
}
