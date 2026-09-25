import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabaseServer';
import { normalizeText } from '@/lib/categorize';

export async function GET(_request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('merchant_rules')
    .select('pattern, category')
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: 'DB error' }, { status: 500 });
  return NextResponse.json({ rules: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json() as { description: string; category: string };
  if (!body.description || !body.category) {
    return NextResponse.json({ error: 'description and category required' }, { status: 400 });
  }

  const pattern = normalizeText(body.description);
  if (!pattern) return NextResponse.json({ error: 'Invalid description' }, { status: 400 });

  const { error } = await supabase
    .from('merchant_rules')
    .upsert(
      { user_id: user.id, pattern, category: body.category, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,pattern' },
    );

  if (error) return NextResponse.json({ error: 'DB error' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
