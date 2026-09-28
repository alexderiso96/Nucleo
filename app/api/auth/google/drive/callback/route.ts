export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabaseServer';

export async function GET(request: NextRequest) {
  const base = process.env.NEXT_PUBLIC_URL!;
  const code  = request.nextUrl.searchParams.get('code');
  const error = request.nextUrl.searchParams.get('error');

  if (error || !code) {
    return NextResponse.redirect(`${base}/import?drive=error`);
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${base}/login`);

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id:     process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri:  `${base}/api/auth/google/drive/callback`,
      grant_type:    'authorization_code',
    }),
  });

  const tokens = await tokenRes.json() as { refresh_token?: string };
  if (!tokens.refresh_token) {
    return NextResponse.redirect(`${base}/import?drive=no_token`);
  }

  await supabase
    .from('profiles')
    .update({ drive_refresh_token: tokens.refresh_token })
    .eq('id', user.id);

  return NextResponse.redirect(`${base}/import?drive=connected`);
}
