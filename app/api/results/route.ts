import { NextResponse } from 'next/server';
import { listCandidates, getAppState } from '@/lib/db';
import { requireUser, isErrorResponse } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await requireUser();
  if (isErrorResponse(session)) return session;

  const state = getAppState();
  if (!state.results_announced && !session.isAdmin) {
    return NextResponse.json({ error: 'Results not announced yet' }, { status: 403 });
  }

  return NextResponse.json({
    male: listCandidates('male', { round: 2, finalistsOnly: true }),
    female: listCandidates('female', { round: 2, finalistsOnly: true }),
    state,
  });
}
