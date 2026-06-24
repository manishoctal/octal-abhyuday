import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { getAppState, getLeaderboard, getUserPoints } from '@/lib/db';
import LeaderboardClient from '@/components/LeaderboardClient';

export const dynamic = 'force-dynamic';

export default async function LeaderboardPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const board = getLeaderboard(50);
  const myPoints = getUserPoints(session.id);
  const myRank = board.findIndex(r => r.user_id === session.id) + 1;

  return (
    <>
      <Header eventName={getAppState().event_name} title="Leaderboard" isAdmin={session.isAdmin} />
      <main className="max-w-lg mx-auto px-4 pt-4">
        <LeaderboardClient
          initial={board}
          myPoints={myPoints}
          myRank={myRank || null}
          myId={session.id}
        />
      </main>
      <BottomNav isAdmin={session.isAdmin} />
    </>
  );
}
