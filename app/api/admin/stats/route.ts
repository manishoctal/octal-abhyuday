import { NextResponse } from 'next/server';
import { getStats, listCandidates, getAppState } from '@/lib/db';
import { requireAdmin, isErrorResponse } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await requireAdmin();
  if (isErrorResponse(session)) return session;

  const state = getAppState();
  const round = state.voting_round;
  const opts = { round, finalistsOnly: round > 1 };

  // Only candidates with actual votes — after a reset the Top-10 cards disappear
  const top = (gender: 'male' | 'female') =>
    listCandidates(gender, opts)
      .filter((c) => c.vote_count > 0)
      .slice(0, 10);

  return NextResponse.json({
    stats: getStats(round),
    topMale: top('male'),
    topFemale: top('female'),
    state,
  });
}
