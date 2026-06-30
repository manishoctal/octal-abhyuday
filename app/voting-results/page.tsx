import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { getAppState } from '@/lib/db';
import ResultsClient from '@/components/ResultsClient';

export const dynamic = 'force-dynamic';

export default async function ResultsPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <>
      <Header eventName={getAppState().event_name} title="Results" isAdmin={session.isAdmin} />
      <ResultsClient isAdmin={!session.isAdmin} />
      <BottomNav isAdmin={session.isAdmin} />
    </>
  );
}
