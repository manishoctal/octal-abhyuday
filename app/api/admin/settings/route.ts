import { NextResponse } from 'next/server';
import { setSetting, getAppState } from '@/lib/db';
import { requireAdmin, isErrorResponse } from '@/lib/api-helpers';
import { broadcast } from '@/lib/events';

export async function POST(req: Request) {
  const session = await requireAdmin();
  if (isErrorResponse(session)) return session;

  const body = await req.json().catch(() => ({}));

  if ('eventName' in body) {
    const { eventName } = body;
    if (typeof eventName !== 'string' || !eventName.trim() || eventName.trim().length > 60) {
      return NextResponse.json({ error: 'Event name must be 1–60 characters' }, { status: 400 });
    }
    setSetting('event_name', eventName.trim());
  }

  if ('totalRounds' in body) {
    const n = Number(body.totalRounds);
    if (!Number.isInteger(n) || n < 1 || n > 10) {
      return NextResponse.json({ error: 'Total rounds must be between 1 and 10' }, { status: 400 });
    }
    const state = getAppState();
    if (n < state.voting_round) {
      return NextResponse.json(
        { error: `Cannot set total rounds below current round (${state.voting_round})` },
        { status: 409 }
      );
    }
    setSetting('total_rounds', String(n));
  }

  broadcast('state');
  return NextResponse.json({ ok: true, state: getAppState() });
}
