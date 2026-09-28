import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabaseServer';

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json() as {
    originalDescription: string;
    description?: string;
    category?: string;
  };

  if (!body.originalDescription) {
    return NextResponse.json({ error: 'originalDescription richiesta' }, { status: 400 });
  }
  if (body.description === undefined && body.category === undefined) {
    return NextResponse.json({ error: 'Nessun campo da aggiornare' }, { status: 400 });
  }

  const payload: Record<string, unknown> = {};
  if (body.description !== undefined) payload.description = body.description;
  if (body.category !== undefined) {
    payload.category = body.category;
    payload.category_confidence = 'high';
  }

  const { error } = await supabase
    .from('expenses')
    .update(payload)
    .eq('user_id', user.id)
    .eq('description', body.originalDescription);

  if (error) return NextResponse.json({ error: 'DB error' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
