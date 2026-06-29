import { NextResponse } from 'next/server';
import { listCandidates, getAppState } from '@/lib/db';
import { requireUser, isErrorResponse } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await requireUser();
  if (isErrorResponse(session)) return session;

  const state = getAppState();
  if (!state.results_announced && !session.isAdmin) {
    return NextResponse.json(
      { error: 'Results not announced yet', voting_state: state.voting_state },
      { status: 403 }
    );
  }

  const finalRound = state.total_rounds;
  return NextResponse.json({
    male:   listCandidates('male',   { round: finalRound, finalistsOnly: finalRound > 1 }),
    female: listCandidates('female', { round: finalRound, finalistsOnly: finalRound > 1 }),
    state,
  });
}
