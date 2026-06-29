import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import VotingModule from '@/components/admin/VotingModule';

export const dynamic = 'force-dynamic';

export default function AdminVotingPage() {
  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">🗳️ Popularity Voting</h1>
          <p className="text-sm text-slate-500 mt-1">Manage candidates, rounds, and announce results.</p>
        </div>
        <Link
          href="/voting-stage"
          target="_blank"
          className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white transition active:scale-95"
          style={{ background: '#FE9234' }}
        >
          <ExternalLink size={14} />
          Stage View
        </Link>
      </div>
      <VotingModule />
    </div>
  );
}
