import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { getAppState, listAwardCategories } from '@/lib/db';
import AwardsClient from '@/components/AwardsClient';

export const dynamic = 'force-dynamic';

export default async function AwardsPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <>
      <Header eventName={getAppState().event_name} title="Awards" isAdmin={session.isAdmin} />
      <main className="max-w-lg mx-auto px-4 pt-4">
        <AwardsClient initial={listAwardCategories()} />
      </main>
      <BottomNav isAdmin={session.isAdmin} />
    </>
  );
}
