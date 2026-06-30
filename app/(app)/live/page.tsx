import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import Header from '@/components/Header';
import { getAppState } from '@/lib/db';
import { getLiveSession, getQuestion } from '@/lib/qa';
import LiveClient from '@/components/LiveClient';

export const dynamic = 'force-dynamic';

export default async function LivePage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const appState = getAppState();
  const liveQa   = getLiveSession();
  const liveQ    = liveQa?.active_question_id ? getQuestion(liveQa.active_question_id) : null;

  const initial = {
    votingLive:   appState.voting_state === 'live',
    votingPaused: appState.voting_state === 'paused',
    liveQa: liveQa
      ? {
          id: liveQa.id,
          title: liveQa.title,
          kind: liveQa.kind,
          activeQuestion: liveQ?.prompt ?? null,
        }
      : null,
  };

  return (
    <>
      <Header eventName={appState.event_name} title="Live Now" isAdmin={session.isAdmin} />
      <main className="max-w-lg mx-auto px-4 pt-6 pb-8">
        <LiveClient initial={initial} />
      </main>

    </>
  );
}
