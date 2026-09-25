import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabaseServer';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('payslips')
    .select('*')
    .eq('user_id', user.id)
    .order('period_month', { ascending: false });

  if (error) return NextResponse.json({ error: 'DB error' }, { status: 500 });
  return NextResponse.json({ payslips: data });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json() as {
    period_month: string;
    gross_amount?: number;
    net_amount?: number;
    irpef?: number;
    inps_contributions?: number;
    regional_municipal_tax?: number;
    overtime_hours?: number;
    overtime_amount?: number;
    meal_vouchers?: number;
    tfr_accrued_period?: number;
    tfr_total?: number;
    employer_name?: string;
    extraction_confidence?: string;
    storage_path?: string;
  };

  if (!body.period_month) {
    return NextResponse.json({ error: 'period_month required' }, { status: 400 });
  }

  const record = {
    user_id: user.id,
    period_month: body.period_month,
    gross_amount: body.gross_amount ?? 0,
    net_amount: body.net_amount ?? 0,
    irpef: body.irpef ?? 0,
    inps_contributions: body.inps_contributions ?? 0,
    regional_municipal_tax: body.regional_municipal_tax ?? 0,
    overtime_hours: body.overtime_hours ?? 0,
    overtime_amount: body.overtime_amount ?? 0,
    meal_vouchers: body.meal_vouchers ?? 0,
    tfr_accrued_this_period: body.tfr_accrued_period ?? 0,
    tfr_total_accrued: body.tfr_total ?? 0,
    employer_name: body.employer_name ?? null,
    extraction_confidence: body.extraction_confidence ?? 'low',
    storage_path: body.storage_path ?? null,
  };

  const { error } = await supabase
    .from('payslips')
    .upsert(record, { onConflict: 'user_id,period_month' });

  if (error) {
    console.error('[payslips POST] DB error code:', error.code, error.hint);
    return NextResponse.json({ error: 'DB error' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
