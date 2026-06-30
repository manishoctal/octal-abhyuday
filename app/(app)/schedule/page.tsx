import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import Header from '@/components/Header';
import { getAppState, listScheduleSessions, getModuleConfig } from '@/lib/db';
import ScheduleClient from '@/components/ScheduleClient';
import ModuleDisabled from '@/components/ModuleDisabled';

export const dynamic = 'force-dynamic';

export default async function SchedulePage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const appState = getAppState();
  if (getModuleConfig().enabled.schedule === false)
    return <ModuleDisabled eventName={appState.event_name} isAdmin={session.isAdmin} />;

  return (
    <>
      <Header eventName={getAppState().event_name} title="Schedule" isAdmin={session.isAdmin} />
      <main className="max-w-lg mx-auto px-4 pt-4">
        <ScheduleClient initial={listScheduleSessions()} />
      </main>

    </>
  );
}
