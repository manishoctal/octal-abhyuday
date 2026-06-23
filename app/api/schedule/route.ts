import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api-helpers';
import { listScheduleSessions } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const err = await requireUser();
  if (err) return err;
  return NextResponse.json({ sessions: listScheduleSessions() });
}
