import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabaseServer';
import type { ColumnMap } from '@/lib/csv-parser';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const fingerprint = request.nextUrl.searchParams.get('fingerprint');
  if (!fingerprint) {
    return NextResponse.json({ error: 'Missing fingerprint' }, { status: 400 });
  }

  const { data } = await supabase
    .from('csv_mappings')
    .select('column_map')
    .eq('user_id', user.id)
    .eq('headers_fingerprint', fingerprint)
    .maybeSingle();

  return NextResponse.json({ mapping: data ? (data.column_map as ColumnMap) : null });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json() as {
    fingerprint: string;
    sourceName: string;
    columnMap: ColumnMap;
  };

  const { fingerprint, sourceName, columnMap } = body;
  if (!fingerprint || !sourceName || !columnMap) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const { error } = await supabase
    .from('csv_mappings')
    .upsert(
      {
        user_id: user.id,
        source_name: sourceName,
        headers_fingerprint: fingerprint,
        column_map: columnMap,
      },
      { onConflict: 'user_id,headers_fingerprint' },
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
