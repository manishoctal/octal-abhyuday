import { NextResponse } from 'next/server';
import { getAppState, getCandidate, setVote, awardPoints } from '@/lib/db';
import { requireUser, isErrorResponse } from '@/lib/api-helpers';
import { broadcast } from '@/lib/events';

export async function POST(req: Request) {
  const session = await requireUser();
  if (isErrorResponse(session)) return session;

  const state = getAppState();
  if (state.voting_state !== 'live') {
    const msg =
      state.voting_state === 'paused'
        ? 'Voting is paused right now'
        : state.voting_state === 'ended'
          ? 'Voting has ended'
          : 'Voting has not started yet';
    return NextResponse.json({ error: msg }, { status: 409 });
  }

  const { candidateId } = await req.json().catch(() => ({}));
  const candidate = typeof candidateId === 'number' ? getCandidate(candidateId) : undefined;
  if (!candidate || !candidate.gender) {
    return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
  }
  if (state.voting_round === 2 && !candidate.is_finalist) {
    return NextResponse.json({ error: 'This candidate is not in the finale' }, { status: 409 });
  }

  // Both rounds: one changeable vote per gender
  setVote(session.id, candidate.id, candidate.gender, state.voting_round);
  awardPoints(session.id, 'voted', 10);
  broadcast('vote');
  return NextResponse.json({ ok: true });
}
