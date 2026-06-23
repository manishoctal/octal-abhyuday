import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api-helpers';
import { listEventInfo } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const err = await requireUser();
  if (err) return err;
  return NextResponse.json({ items: listEventInfo() });
}
