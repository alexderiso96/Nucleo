export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabaseServer';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const from = searchParams.get('from');
  const to   = searchParams.get('to');
  const type = searchParams.get('type') ?? 'expense';

  let query = supabase
    .from('expenses')
    .select('category, amount, is_income, expense_date');

  if (from) query = query.gte('expense_date', from);
  if (to)   query = query.lte('expense_date', to);
  if (type === 'expense') query = query.eq('is_income', false);
  if (type === 'income')  query = query.eq('is_income', true);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const byCategory: Record<string, { total: number; count: number }> = {};
  for (const row of data ?? []) {
    const cat = row.category ?? 'altro';
    if (!byCategory[cat]) byCategory[cat] = { total: 0, count: 0 };
    byCategory[cat].total += Number(row.amount);
    byCategory[cat].count += 1;
  }

  const result = Object.entries(byCategory)
    .map(([category, { total, count }]) => ({ category, total, count }))
    .sort((a, b) => b.total - a.total);

  return NextResponse.json({
    data: result,
    total: result.reduce((s, r) => s + r.total, 0),
  });
}
