import { NextResponse } from 'next/server';
import { requireUser, isErrorResponse } from '@/lib/api-helpers';
import { createToken } from '@/lib/download-tokens';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const userOrErr = await requireUser();
  if (isErrorResponse(userOrErr)) return userOrErr;

  const { photoIds } = await req.json().catch(() => ({}));
  if (!Array.isArray(photoIds) || photoIds.length === 0)
    return NextResponse.json({ error: 'photoIds required' }, { status: 400 });
  if (photoIds.length > 500)
    return NextResponse.json({ error: 'Too many photos (max 500)' }, { status: 400 });

  return NextResponse.json({ token: createToken(photoIds) });
}
