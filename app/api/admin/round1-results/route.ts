import { NextResponse } from 'next/server';
import { requireAdmin, isErrorResponse } from '@/lib/api-helpers';
import { getAppState, listCandidates, promoteTopByVotes } from '@/lib/db';
import { broadcast } from '@/lib/events';

export const dynamic = 'force-dynamic';

/** Round-1 results: ranked lists per gender (JSON), or ?format=csv for download. */
export async function GET(req: Request) {
  const session = await requireAdmin();
  if (isErrorResponse(session)) return session;

  const male = listCandidates('male', { round: 1 });
  const female = listCandidates('female', { round: 1 });

  if (new URL(req.url).searchParams.get('format') === 'csv') {
    const esc = (v: string | null) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = ['rank,name,gender,email,votes,finalist'];
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
        'Content-Disposition': 'attachment; filename="round1-results.csv"',
      },
    });
  }

  return NextResponse.json({ male, female, state: getAppState() });
}

/** Promote the top N per gender (admin-chosen counts) to the round-2 finale. */
export async function POST(req: Request) {
  const session = await requireAdmin();
  if (isErrorResponse(session)) return session;

  const state = getAppState();
  if (state.voting_round !== 1) {
    return NextResponse.json({ error: 'Already in round 2' }, { status: 409 });
  }
  if (state.voting_state !== 'ended') {
    return NextResponse.json({ error: 'End round-1 voting before promoting finalists' }, { status: 409 });
  }

  const { maleCount, femaleCount } = await req.json().catch(() => ({}));
  const m = Number(maleCount);
  const f = Number(femaleCount);
  if (!Number.isInteger(m) || !Number.isInteger(f) || m < 1 || f < 1 || m > 50 || f > 50) {
    return NextResponse.json({ error: 'Counts must be between 1 and 50' }, { status: 400 });
  }

  const promoted = promoteTopByVotes(m, f);
  broadcast('state');
  return NextResponse.json({
    ok: true,
    state: getAppState(),
    finalists: {
      male: promoted.male.map((c) => c.name),
      female: promoted.female.map((c) => c.name),
    },
  });
}
