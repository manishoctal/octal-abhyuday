import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import Header from '@/components/Header';
import { getAppState } from '@/lib/db';
import ResultsClient from '@/components/ResultsClient';

export const dynamic = 'force-dynamic';

export default async function ResultsPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <>
      <Header name={session.name} eventName={getAppState().event_name} isAdmin={session.isAdmin} />
      <ResultsClient isAdmin={session.isAdmin} />
    </>
  );
}
