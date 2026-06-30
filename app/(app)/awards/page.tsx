import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import Header from '@/components/Header';
import { getAppState, listAwardCategories, getModuleConfig } from '@/lib/db';
import AwardsClient from '@/components/AwardsClient';
import ModuleDisabled from '@/components/ModuleDisabled';

export const dynamic = 'force-dynamic';

export default async function AwardsPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const appState = getAppState();
  if (getModuleConfig().enabled.awards === false)
    return <ModuleDisabled eventName={appState.event_name} isAdmin={session.isAdmin} />;

  return (
    <>
      <Header eventName={getAppState().event_name} title="Awards" isAdmin={session.isAdmin} />
      <main className="max-w-lg mx-auto px-4 pt-4">
        <AwardsClient initial={listAwardCategories()} />
      </main>

    </>
  );
}
