import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import Header from '@/components/Header';
import { getAppState, listScheduleSessions, getAttendance } from '@/lib/db';
import DashboardClient from '@/components/DashboardClient';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const appState = getAppState();
  const schedule = listScheduleSessions();
  const attendance = getAttendance(session.id);

  return (
    <>
      <Header name={session.name} eventName={appState.event_name} isAdmin={session.isAdmin} />
      <main className="max-w-2xl mx-auto px-4 pt-4 pb-24">
        <DashboardClient
          eventName={appState.event_name}
          schedule={schedule}
          votingState={appState.voting_state}
          votingRound={appState.voting_round}
          isCheckedIn={!!attendance}
          userId={session.id}
          userName={session.name}
        />
      </main>
    </>
  );
}
