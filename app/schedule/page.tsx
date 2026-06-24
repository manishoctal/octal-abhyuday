import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { getAppState, listScheduleSessions } from '@/lib/db';
import ScheduleClient from '@/components/ScheduleClient';

export const dynamic = 'force-dynamic';

export default async function SchedulePage() {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <>
      <Header eventName={getAppState().event_name} title="Schedule" isAdmin={session.isAdmin} />
      <main className="max-w-lg mx-auto px-4 pt-4">
        <ScheduleClient initial={listScheduleSessions()} />
      </main>
      <BottomNav isAdmin={session.isAdmin} />
    </>
  );
}
