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
  const male   = listCandidates('male',   { round, finalistsOnly: round > 1 });
  const female = listCandidates('female', { round, finalistsOnly: round > 1 });

  if (new URL(req.url).searchParams.get('format') === 'csv') {
    const esc = (v: string | null) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [`rank,name,gender,email,votes,advancing_to_round_${round + 1}`];
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
  if (state.voting_round >= state.total_rounds) {
    return NextResponse.json(
      { error: `Already in the Grand Finale (round ${state.total_rounds}) — no further rounds to promote to` },
      { status: 409 }
    );
  }
  if (state.voting_state !== 'ended') {
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

  const nextRound = state.voting_round + 1;
  const promoted = promoteTopByVotes(m, f, state.voting_round, nextRound);
  broadcast('state');
  sendPushToAll(
    `🎖️ Round ${nextRound} is now open!`,
    `Finalists have been selected — vote now in Round ${nextRound}.`,
    '/vote'
  ).catch(() => {});
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
