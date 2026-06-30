import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { getAppState, getModuleConfig } from '@/lib/db';
import QnaClient from '@/components/QnaClient';
import ModuleDisabled from '@/components/ModuleDisabled';

export const dynamic = 'force-dynamic';

export default async function QnaPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const appState = getAppState();
  if (getModuleConfig().enabled.qna === false)
    return <ModuleDisabled eventName={appState.event_name} isAdmin={session.isAdmin} />;

  return (
    <>
      <Header eventName={getAppState().event_name} title="Live Q&A" isAdmin={session.isAdmin} />
      <main className="max-w-lg mx-auto px-4 pt-4">
        <QnaClient />
      </main>
      <BottomNav isAdmin={session.isAdmin} />
    </>
  );
}
