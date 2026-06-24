import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import Header from '@/components/Header';
import { getAppState } from '@/lib/db';
import VotingModule from '@/components/admin/VotingModule';

export const dynamic = 'force-dynamic';

export default async function AdminVotingPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!session.isAdmin) redirect('/');

  return (
    <>
      <Header name={session.name} eventName={getAppState().event_name} isAdmin={session.isAdmin} />
      <main className="max-w-3xl mx-auto px-4 pt-4 pb-24">
        <div className="mb-4">
          <Link href="/admin" className="text-sm font-semibold text-brand-600 hover:text-brand-700">
            ← All modules
          </Link>
          <div className="flex items-center justify-between mt-1">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">
              🗳️ Popularity Voting
            </h1>
            <Link
              href="/voting-stage"
              target="_blank"
              className="flex items-center gap-1.5 px-4 py-2 rounded-2xl text-sm font-bold text-white transition active:scale-95"
              style={{ background: '#FE9234' }}
            >
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <rect x="1" y="3" width="13" height="9" rx="2" stroke="white" strokeWidth="1.4"/>
                <path d="M5 12l2.5 2L10 12" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M7.5 14v-2" stroke="white" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
              Stage View
            </Link>
          </div>
        </div>
        <VotingModule />
      </main>
    </>
  );
}
