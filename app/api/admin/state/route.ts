import { NextResponse } from 'next/server';
import { db, getAppState, setSetting } from '@/lib/db';
import { requireAdmin, isErrorResponse } from '@/lib/api-helpers';
import type { VotingState } from '@/lib/types';
import { broadcast } from '@/lib/events';
import { sendPushToAll } from '@/lib/push';

type Action = 'start' | 'pause' | 'resume' | 'end' | 'announce' | 'reset' | 'back_to_round1' | 'redo_round';

const transitions: Record<Action, { from: VotingState[]; to?: VotingState }> = {
  start: { from: ['not_started'], to: 'live' },
  pause: { from: ['live'], to: 'paused' },
  resume: { from: ['paused'], to: 'live' },
  end: { from: ['live', 'paused'], to: 'ended' },
  announce: { from: ['ended'] },
  reset: { from: ['not_started', 'live', 'paused', 'ended'], to: 'not_started' },
  back_to_round1: { from: ['not_started', 'live', 'paused', 'ended'] },
  redo_round: { from: ['ended'] },
};

export async function POST(req: Request) {
  const session = await requireAdmin();
  if (isErrorResponse(session)) return session;

  const { action } = (await req.json().catch(() => ({}))) as { action?: Action };
  if (!action || !(action in transitions)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  const state = getAppState();
  const t = transitions[action];
  if (!t.from.includes(state.voting_state)) {
    return NextResponse.json(
      { error: `Cannot ${action} while voting is "${state.voting_state}"` },
      { status: 409 }
    );
  }

  if (action === 'announce') {
    if (state.voting_round !== state.total_rounds) {
      return NextResponse.json(
        { error: `Results can only be announced in the Grand Finale (round ${state.total_rounds})` },
        { status: 409 }
      );
    }
    if (state.results_announced) {
      return NextResponse.json({ error: 'Results already announced' }, { status: 409 });
    }
    setSetting('results_announced', '1');
  } else if (action === 'redo_round') {
    db.prepare('DELETE FROM votes WHERE round = ?').run(state.voting_round);
    if (state.voting_round > 1 && state.voting_round < state.total_rounds) {
      // Intermediate round: clear finalists so the re-promote step picks the correct count.
      // Final round: keep finalists — the same people just vote again.
      db.prepare('UPDATE candidates SET is_finalist = 0').run();
    }
    setSetting('voting_state', 'not_started');
    setSetting('results_announced', '0');
  } else if (action === 'back_to_round1') {
    if (state.voting_round <= 1) {
      return NextResponse.json({ error: 'Already in round 1' }, { status: 409 });
    }
    // Reset to round 1 ended state so the promote panel is immediately available.
    // Delete all votes from rounds > 1 (stale votes would bias re-promotion rankings).
    setSetting('voting_round', '1');
    setSetting('voting_state', 'ended');
    setSetting('results_announced', '0');
    db.prepare('UPDATE candidates SET is_finalist = 0').run();
    db.prepare('DELETE FROM votes WHERE round > 1').run();
  } else if (action === 'reset') {
    // Full reset to a fresh round-1 qualifier: clears votes, finalists and announcement
    setSetting('voting_state', 'not_started');
    setSetting('voting_round', '1');
    setSetting('results_announced', '0');
    db.prepare('UPDATE candidates SET is_finalist = 0').run();
    db.prepare('DELETE FROM votes').run();
  } else {
    setSetting('voting_state', t.to!);
  }

  const ALERTS: Partial<Record<Action, Parameters<typeof broadcast>[1] & { pushUrl?: string }>> = {
    start:    { kind: 'voting_live',        title: '🗳️ Voting is open!',       body: 'Cast your vote now before it closes.',      pushUrl: '/vote'  },
    resume:   { kind: 'voting_live',        title: '🗳️ Voting resumed!',        body: 'Voting is live again — cast your vote.',    pushUrl: '/vote'  },
    pause:    { kind: 'voting_paused',      title: '⏸️ Voting paused',          body: 'Hold tight — voting will resume shortly.'                     },
    end:      { kind: 'voting_ended',       title: '🏁 Voting has closed',      body: 'Votes are in! Results coming soon.'                           },
    announce: { kind: 'results_announced',  title: '🎉 Results Announced!',     body: 'The winners of ABHYUDAY 2026 are revealed!', pushUrl: '/voting-results' },
  };

  const alert = ALERTS[action];
  broadcast('state', alert);

  // Push notification to all devices for key actions
  if (alert) {
    sendPushToAll(alert.title!, alert.body!, alert.pushUrl ?? '/').catch(() => {});
  }

  return NextResponse.json({ ok: true, state: getAppState() });
}
