export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabaseServer';

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { folderId } = await request.json() as { folderId: string };
  if (!folderId || typeof folderId !== 'string') {
    return NextResponse.json({ error: 'Invalid folderId' }, { status: 400 });
  }

  const { error } = await supabase
    .from('profiles')
    .update({ drive_folder_id: folderId })
    .eq('id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await supabase
    .from('profiles')
    .update({ drive_refresh_token: null, drive_folder_id: null })
    .eq('id', user.id);

  return NextResponse.json({ ok: true });
}
