import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { getAppState, listScheduleSessions, getAttendance, getUserById, listAllUsers, listAwardCategories } from '@/lib/db';
import { getLiveSession } from '@/lib/qa';
import DashboardClient from '@/components/DashboardClient';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const session = await getSession();
  if (!session) redirect('/login');

  // Gate: profile photo is mandatory before using the app
  const user = getUserById(session.id);
  if (!user?.profile_photo_url) redirect('/profile?required=1');

  const appState   = getAppState();
  const schedule   = listScheduleSessions();
  const attendance = getAttendance(session.id);
  const liveQa     = getLiveSession();
  const participants = listAllUsers().length;
  const awardCount   = listAwardCategories().length;

  return (
    <>
      <Header eventName={appState.event_name} isAdmin={session.isAdmin} />
      <main className="max-w-lg mx-auto px-4 pt-4">
        <DashboardClient
          eventName={appState.event_name}
          schedule={schedule}
          votingState={appState.voting_state}
          votingRound={appState.voting_round}
          isCheckedIn={!!attendance}
          userId={session.id}
          userName={session.name}
          liveQa={!!liveQa}
          participants={participants}
          awardCount={awardCount}
        />
      </main>
      <BottomNav isAdmin={session.isAdmin} />
    </>
  );
}
