import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import Header from '@/components/Header';
import { getAppState } from '@/lib/db';
import VotingClient from '@/components/VotingClient';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <>
      <Header name={session.name} eventName={getAppState().event_name} isAdmin={session.isAdmin} />
      <main className="max-w-5xl mx-auto px-4 pt-4">
        <VotingClient greeting={`Hey ${session.name.split(' ')[0]} 👋 — one pick per category`} />
      </main>
    </>
  );
}
