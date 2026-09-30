import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabaseServer';

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data } = await supabase
    .from('profiles')
    .select('full_name, username')
    .eq('id', user.id)
    .single();

  return NextResponse.json({ full_name: data?.full_name ?? null, username: data?.username ?? null, email: user.email });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json() as { full_name?: string; username?: string };
  const update: Record<string, string | null> = {};

  if ('full_name' in body) {
    update.full_name = body.full_name?.trim() || null;
  }

  if ('username' in body) {
    const u = body.username?.trim().toLowerCase() ?? '';
    if (u && !USERNAME_RE.test(u)) {
      return NextResponse.json({ error: 'Username non valido (3-20 caratteri: lettere minuscole, numeri, _)' }, { status: 400 });
    }
    update.username = u || null;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ ok: true });
  }

  const { error } = await supabase
    .from('profiles')
    .update(update)
    .eq('id', user.id);

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Username già in uso, scegline un altro' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Errore aggiornamento profilo' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
