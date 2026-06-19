import { NextResponse } from 'next/server';
import { listCandidates, getUserVotes, getAppState } from '@/lib/db';
import { getLiveSession } from '@/lib/qa';
import { requireUser, isErrorResponse } from '@/lib/api-helpers';
import type { Gender } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const session = await requireUser();
  if (isErrorResponse(session)) return session;

  const { searchParams } = new URL(req.url);
  const genderParam = searchParams.get('gender');
  const gender =
    genderParam === 'male' || genderParam === 'female' ? (genderParam as Gender) : undefined;

  const state = getAppState();
  const round = state.voting_round;

  let candidates = listCandidates(gender, {
    round,
    finalistsOnly: round === 2,
    // Qualifier: neutral alphabetical order, no standings
    orderByName: round === 1,
  });
  if (round === 1) {
    // Counts are admin-only during the qualifier
    candidates = candidates.map((c) => ({ ...c, vote_count: 0 }));
  }

  return NextResponse.json({
    candidates,
    myVotes: getUserVotes(session.id, round),
    state,
    qaLive: !!getLiveSession(),
  });
}
