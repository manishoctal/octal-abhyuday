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
  if (state.voting_round > 1 && !candidate.is_finalist) {
    return NextResponse.json({ error: 'This candidate did not advance to this round' }, { status: 409 });
  }

  const emailMatch = candidate.email && session.email &&
    candidate.email.toLowerCase() === session.email.toLowerCase();
  const codeMatch = candidate.employee_code && session.employee_code &&
    candidate.employee_code === session.employee_code;
  if (emailMatch || codeMatch) {
    return NextResponse.json({ error: 'You cannot vote for yourself' }, { status: 403 });
  }

  // Both rounds: one changeable vote per gender
  setVote(session.id, candidate.id, candidate.gender, state.voting_round);
  awardPoints(session.id, 'voted', 10);
  broadcast('vote');
  return NextResponse.json({ ok: true });
}
