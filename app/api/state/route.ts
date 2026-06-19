import { NextResponse } from 'next/server';
import { getAppState } from '@/lib/db';
import { requireUser, isErrorResponse } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await requireUser();
  if (isErrorResponse(session)) return session;
  return NextResponse.json(getAppState());
}
