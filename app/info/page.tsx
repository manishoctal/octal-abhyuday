import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/lib/auth';
import Header from '@/components/Header';
import { getAppState, listEventInfo } from '@/lib/db';
import InfoClient from '@/components/InfoClient';

export const dynamic = 'force-dynamic';

export default async function InfoPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <>
      <Header name={session.name} eventName={getAppState().event_name} isAdmin={session.isAdmin} />
      <main className="max-w-2xl mx-auto px-4 pt-4 pb-24">
        <div className="mb-5">
          <Link href="/" className="text-sm font-semibold text-brand-600 hover:text-brand-700">← Home</Link>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1">📍 Venue & Event Info</h1>
          <p className="text-sm text-slate-500 mt-0.5">Everything you need to know about the event</p>
        </div>
        <InfoClient initial={listEventInfo()} />
      </main>
    </>
  );
}
