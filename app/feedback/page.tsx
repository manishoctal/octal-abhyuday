import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { getAppState, getFeedback, listScheduleSessions } from '@/lib/db';
import FeedbackClient from '@/components/FeedbackClient';

export const dynamic = 'force-dynamic';

export default async function FeedbackPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const existing = getFeedback(session.id);
  const sessions = listScheduleSessions();

  return (
    <>
      <Header eventName={getAppState().event_name} title="Feedback" isAdmin={session.isAdmin} />
      <main className="max-w-lg mx-auto px-4 pt-4">
        <FeedbackClient existing={existing ?? null} sessions={sessions} />
      </main>
      <BottomNav isAdmin={session.isAdmin} />
    </>
  );
}
