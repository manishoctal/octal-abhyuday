import { getLeaderboard } from '@/lib/db';
import LeaderboardClient from '@/components/LeaderboardClient';

export const dynamic = 'force-dynamic';

export default function AdminLeaderboardPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-slate-900">🏆 Leaderboard</h1>
        <p className="text-sm text-slate-500 mt-1">Top participants by points earned from voting, check-in, and feedback.</p>
      </div>
      <LeaderboardClient initial={getLeaderboard(100)} myPoints={0} myRank={null} myId={-1} />
    </div>
  );
}
