import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import Header from '@/components/Header';
import { getAppState, getLeaderboard } from '@/lib/db';
import LeaderboardClient from '@/components/LeaderboardClient';

export const dynamic = 'force-dynamic';

export default async function AdminLeaderboardPage() {
  const session = await getSession();
  if (!session?.isAdmin) redirect('/');
  const board = getLeaderboard(100);
  return (
    <>
      <Header eventName={getAppState().event_name} title="Leaderboard" isAdmin back="/admin" />
      <main className="max-w-lg mx-auto px-4 pt-4 pb-8">
        <LeaderboardClient initial={board} myPoints={0} myRank={null} myId={-1} />
      </main>
    </>
  );
}
