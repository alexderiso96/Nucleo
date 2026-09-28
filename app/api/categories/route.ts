export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabaseServer';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('user_categories')
    .select('id, value, label, icon, color')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ categories: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json() as { value?: string; label?: string; icon?: string; color?: string };
  const { value, label, icon = '📦', color = '#64748b' } = body;

  if (!value?.trim() || !label?.trim())
    return NextResponse.json({ error: 'value e label richiesti' }, { status: 400 });

  const slug = value.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');

  const { data, error } = await supabase
    .from('user_categories')
    .insert({ user_id: user.id, value: slug, label: label.trim(), icon, color })
    .select('id, value, label, icon, color')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ category: data });
}
