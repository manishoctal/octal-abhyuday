import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { getAppState, getModuleConfig } from '@/lib/db';
import VotingClient from '@/components/VotingClient';
import ModuleDisabled from '@/components/ModuleDisabled';

export const dynamic = 'force-dynamic';

export default async function VotePage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const appState = getAppState();
  if (getModuleConfig().enabled.vote === false)
    return <ModuleDisabled eventName={appState.event_name} isAdmin={session.isAdmin} />;

  return (
    <>
      <Header eventName={getAppState().event_name} title="Vote" isAdmin={session.isAdmin} />
      <main className="max-w-5xl mx-auto px-4 pt-4">
        <VotingClient greeting={`Hey ${session.name.split(' ')[0]} 👋 — one pick per category`} />
      </main>
      <BottomNav isAdmin={session.isAdmin} />
    </>
  );
}
