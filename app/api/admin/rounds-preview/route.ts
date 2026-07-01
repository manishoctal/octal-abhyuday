import { NextResponse } from 'next/server';
import { requireAdmin, isErrorResponse } from '@/lib/api-helpers';
import { getAppState, listCandidates } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await requireAdmin();
  if (isErrorResponse(session)) return session;

  const state = getAppState();
  const rounds = [];

  for (let r = 1; r <= state.total_rounds; r++) {
    if (r > state.voting_round) {
      rounds.push({ round: r, male: null, female: null, status: 'pending' as const });
    } else {
      const male   = listCandidates('male',   { round: r, finalistsOnly: r > 1 });
      const female = listCandidates('female', { round: r, finalistsOnly: r > 1 });
      const status = r < state.voting_round ? 'ended' : state.voting_state;
      rounds.push({ round: r, male, female, status });
    }
  }

  return NextResponse.json({ rounds, state });
}
