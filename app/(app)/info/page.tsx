import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import Header from '@/components/Header';
import { getAppState, listEventInfo, getModuleConfig } from '@/lib/db';
import InfoClient from '@/components/InfoClient';
import ModuleDisabled from '@/components/ModuleDisabled';

export const dynamic = 'force-dynamic';

export default async function InfoPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const appState = getAppState();
  if (getModuleConfig().enabled.venue === false)
    return <ModuleDisabled eventName={appState.event_name} isAdmin={session.isAdmin} />;

  return (
    <>
      <Header eventName={getAppState().event_name} title="Venue & Info" isAdmin={session.isAdmin} />
      <main className="max-w-lg mx-auto px-4 pt-4">
        <InfoClient initial={listEventInfo()} />
      </main>

    </>
  );
}
