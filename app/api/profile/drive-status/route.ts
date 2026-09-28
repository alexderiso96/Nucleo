export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabaseServer';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ isConnected: false, hasFolderId: false, lastSyncedAt: null });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('drive_refresh_token, drive_folder_id, drive_last_synced_at')
    .eq('id', user.id)
    .single();

  return NextResponse.json({
    isConnected:  !!profile?.drive_refresh_token,
    hasFolderId:  !!profile?.drive_folder_id,
    lastSyncedAt: profile?.drive_last_synced_at ?? null,
  });
}
