import { NextResponse } from 'next/server';
import { requireAdmin, isErrorResponse } from '@/lib/api-helpers';
import { getAppState, listCandidates, promoteTopByVotes } from '@/lib/db';
import { broadcast } from '@/lib/events';
import { sendPushToAll } from '@/lib/push';

export const dynamic = 'force-dynamic';

/** Results for the current round (ranked per gender), or ?format=csv for download. */
export async function GET(req: Request) {
  const session = await requireAdmin();
  if (isErrorResponse(session)) return session;

  const state = getAppState();
  const round = state.voting_round;
  // When a round hasn't started yet and we're past Round 1, show the previous round's
  // ranked results so the admin can see the original vote counts before re-promoting.
  const isRedo = round > 1 && state.voting_state === 'not_started';
  const displayRound = isRedo ? round - 1 : round;
  // Use finalistsOnly only on the first pass; after a redo the flags are cleared so
  // we fall back to all candidates ranked by vote count.
  const male   = listCandidates('male',   { round: displayRound, finalistsOnly: false });
  const female = listCandidates('female', { round: displayRound, finalistsOnly: false });

  if (new URL(req.url).searchParams.get('format') === 'csv') {
    const esc = (v: string | null) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csvNextRound = isRedo ? round : round + 1;
    const lines = [`rank,name,gender,email,votes,advancing_to_round_${csvNextRound}`];
    for (const list of [male, female]) {
      list.forEach((c, i) => {
        lines.push(
          [i + 1, esc(c.name), c.gender, esc(c.email), c.vote_count, c.is_finalist ? 'yes' : 'no'].join(',')
        );
      });
    }
    return new Response(lines.join('\r\n'), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="round${round}-results.csv"`,
      },
    });
  }

  return NextResponse.json({ male, female, state });
}

/** Promote the top N per gender to the next round. */
export async function POST(req: Request) {
  const session = await requireAdmin();
  if (isErrorResponse(session)) return session;

  const state = getAppState();
  // Allow re-promotion into the Grand Finale when it's a redo (not_started at final round)
  const isRedoFinal = state.voting_state === 'not_started' && state.voting_round === state.total_rounds && state.voting_round > 1;
  if (state.voting_round >= state.total_rounds && !isRedoFinal) {
    return NextResponse.json(
      { error: `Already in the Grand Finale (round ${state.total_rounds}) — no further rounds to promote to` },
      { status: 409 }
    );
  }
  if (state.voting_state !== 'ended' && state.voting_state !== 'not_started') {
    return NextResponse.json(
      { error: 'End current round voting before promoting candidates' },
      { status: 409 }
    );
  }

  const { maleCount, femaleCount } = await req.json().catch(() => ({}));
  const m = Number(maleCount);
  const f = Number(femaleCount);
  if (!Number.isInteger(m) || !Number.isInteger(f) || m < 1 || f < 1 || m > 200 || f > 200) {
    return NextResponse.json({ error: 'Counts must be between 1 and 200' }, { status: 400 });
  }

  // Re-do case: round hasn't started yet — re-promote from the previous round's votes,
  // keeping the current round number (no advancement).
  const isRedo = state.voting_state === 'not_started' && state.voting_round > 1;
  const fromRound = isRedo ? state.voting_round - 1 : state.voting_round;
  const nextRound = isRedo ? state.voting_round : state.voting_round + 1;
  const promoted = promoteTopByVotes(m, f, fromRound, nextRound);
  broadcast('state');
  // Only push when actually advancing to a new round — redo just re-selects finalists,
  // voting hasn't opened yet so "Round N is now open" would be misleading.
  if (!isRedo) {
    sendPushToAll(
      `🎖️ Round ${nextRound} is now open!`,
      `Finalists have been selected — vote now in Round ${nextRound}.`,
      '/vote'
    ).catch(() => {});
  }
  return NextResponse.json({
    ok: true,
    state: getAppState(),
    nextRound,
    finalists: {
      male:   promoted.male.map((c) => c.name),
      female: promoted.female.map((c) => c.name),
    },
  });
}
