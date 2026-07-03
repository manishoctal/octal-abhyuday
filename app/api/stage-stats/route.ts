import { NextResponse } from 'next/server';
import { getStats, listCandidates, getAppState } from '@/lib/db';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/** Public-ish stats for the voting stage view.
 *  Requires any valid session (not admin-only) since the /voting-stage page
 *  already enforces admin-only access server-side.
 */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const state = getAppState();
  const round = state.voting_round;
  const opts = { round, finalistsOnly: round > 1 };

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
