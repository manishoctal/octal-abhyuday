import { NextResponse } from 'next/server';
import { setSetting, getAppState } from '@/lib/db';
import { requireAdmin, isErrorResponse } from '@/lib/api-helpers';
import { broadcast } from '@/lib/events';

export async function POST(req: Request) {
  const session = await requireAdmin();
  if (isErrorResponse(session)) return session;

  const { eventName } = await req.json().catch(() => ({}));
  if (typeof eventName !== 'string' || !eventName.trim() || eventName.trim().length > 60) {
    return NextResponse.json(
      { error: 'Event name must be 1–60 characters' },
      { status: 400 }
    );
  }

  setSetting('event_name', eventName.trim());
  broadcast('state');
  return NextResponse.json({ ok: true, state: getAppState() });
}
