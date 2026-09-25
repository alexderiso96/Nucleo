import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabaseServer';

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('household_id')
    .eq('id', user.id)
    .single();

  if (!profile?.household_id) {
    return NextResponse.json({ error: 'Non sei in nessun nucleo familiare' }, { status: 400 });
  }

  const { error } = await supabase
    .from('profiles')
    .update({ household_id: null })
    .eq('id', user.id);

  if (error) return NextResponse.json({ error: 'Errore' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
