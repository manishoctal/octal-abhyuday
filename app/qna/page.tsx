import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import Header from '@/components/Header';
import { getAppState } from '@/lib/db';
import QnaClient from '@/components/QnaClient';

export const dynamic = 'force-dynamic';

export default async function QnaPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <>
      <Header name={session.name} eventName={getAppState().event_name} isAdmin={session.isAdmin} />
      <main className="max-w-2xl mx-auto px-4 pt-4 pb-24">
        <QnaClient />
      </main>
    </>
  );
}
