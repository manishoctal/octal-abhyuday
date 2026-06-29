import { NextResponse } from 'next/server';
import { requireUser, isErrorResponse } from '@/lib/api-helpers';
import { checkIn, awardPoints, getCheckinToken } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const userOrErr = await requireUser();
  if (isErrorResponse(userOrErr)) return userOrErr;

  const { token } = await req.json().catch(() => ({})) as { token?: string };
  if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 });

  if (token !== getCheckinToken()) {
    return NextResponse.json({ error: 'Invalid QR code. Please scan the current venue QR.' }, { status: 403 });
  }

  const result = checkIn(userOrErr.id);
  if (result.changes > 0) awardPoints(userOrErr.id, 'check_in', 15);
  return NextResponse.json({ ok: true, alreadyCheckedIn: result.changes === 0 });
}
