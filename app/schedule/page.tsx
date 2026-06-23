import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/lib/auth';
import Header from '@/components/Header';
import { getAppState, listScheduleSessions } from '@/lib/db';
import ScheduleClient from '@/components/ScheduleClient';

export const dynamic = 'force-dynamic';

export default async function SchedulePage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const sessions = listScheduleSessions();

  return (
    <>
      <Header name={session.name} eventName={getAppState().event_name} isAdmin={session.isAdmin} />
      <main className="max-w-2xl mx-auto px-4 pt-4 pb-24">
        <div className="mb-5">
          <Link href="/" className="text-sm font-semibold text-brand-600 hover:text-brand-700">← Home</Link>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1">📅 Event Schedule</h1>
          <p className="text-sm text-slate-500 mt-0.5">Full agenda — live session highlighted in green</p>
        </div>
        <ScheduleClient initial={sessions} />
      </main>
    </>
  );
}
