export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { syncDriveForUser } from '@/lib/drive-sync';

export async function POST() {
  const result = await syncDriveForUser();
  return NextResponse.json(result);
}
