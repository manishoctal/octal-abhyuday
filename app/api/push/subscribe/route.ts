import { NextResponse } from 'next/server';
import { requireUser, isErrorResponse } from '@/lib/api-helpers';
import { savePushSubscription, deletePushSubscription } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const userOrErr = await requireUser();
  if (isErrorResponse(userOrErr)) return userOrErr;

  const { subscription, platform = 'web' } = await req.json();
  if (!subscription) return NextResponse.json({ error: 'subscription required' }, { status: 400 });

  savePushSubscription(
    userOrErr.id,
    platform as 'web',
    typeof subscription === 'string' ? subscription : JSON.stringify(subscription)
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const userOrErr = await requireUser();
  if (isErrorResponse(userOrErr)) return userOrErr;

  const { platform = 'web' } = await req.json().catch(() => ({}));
  deletePushSubscription(userOrErr.id, platform as 'web');
  return NextResponse.json({ ok: true });
}
