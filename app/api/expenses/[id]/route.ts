import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabaseServer';
//commento
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json() as {
    category?: string;
    is_shared?: boolean;
  };

  // Almeno un campo da aggiornare
  if (body.category === undefined && body.is_shared === undefined) {
    return NextResponse.json({ error: 'Nessun campo da aggiornare' }, { status: 400 });
  }

  // Prepara il payload di update
  const updatePayload: Record<string, unknown> = {};

  if (body.category !== undefined) {
    updatePayload.category = body.category;
    updatePayload.category_confidence = 'high';
  }

  if (body.is_shared !== undefined) {
    updatePayload.is_shared = body.is_shared;

    // Se si condivide, recupera e imposta household_id; se si de-condivide, lascia invariato
    if (body.is_shared === true) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('household_id')
        .eq('id', user.id)
        .single();

      if (!profile?.household_id) {
        return NextResponse.json(
          { error: 'Devi far parte di un nucleo familiare per condividere una spesa' },
          { status: 400 },
        );
      }
      updatePayload.household_id = profile.household_id;
    }
  }

  const { error } = await supabase
    .from('expenses')
    .update(updatePayload)
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: 'DB error' }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { error } = await supabase
    .from('expenses')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: 'DB error' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
