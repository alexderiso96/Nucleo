import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabaseServer';

function firstOfMonth(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
}

// GET /api/budgets?month=YYYY-MM  (default: mese corrente)
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const monthParam = searchParams.get('month');
  const month = monthParam ? `${monthParam}-01` : firstOfMonth(new Date());

  const { data, error } = await supabase
    .from('budgets')
    .select('id, category, month, amount')
    .eq('user_id', user.id)
    .eq('month', month);

  if (error) return NextResponse.json({ error: 'DB error' }, { status: 500 });
  return NextResponse.json({ budgets: data ?? [] });
}

// POST /api/budgets — upsert { category, amount, month? }
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json() as { category?: string; amount?: number; month?: string };
  if (!body.category || typeof body.amount !== 'number' || body.amount <= 0) {
    return NextResponse.json({ error: 'category e amount (> 0) richiesti' }, { status: 400 });
  }

  const month = body.month ? `${body.month}-01` : firstOfMonth(new Date());

  const { error } = await supabase.from('budgets').upsert(
    { user_id: user.id, category: body.category, month, amount: body.amount },
    { onConflict: 'user_id,category,month' },
  );

  if (error) return NextResponse.json({ error: 'DB error' }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE /api/budgets?category=xxx&month=YYYY-MM
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');
  const monthParam = searchParams.get('month');
  if (!category) return NextResponse.json({ error: 'category richiesta' }, { status: 400 });

  const month = monthParam ? `${monthParam}-01` : firstOfMonth(new Date());

  const { error } = await supabase
    .from('budgets')
    .delete()
    .eq('user_id', user.id)
    .eq('category', category)
    .eq('month', month);

  if (error) return NextResponse.json({ error: 'DB error' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
