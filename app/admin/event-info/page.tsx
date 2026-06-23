import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import Header from '@/components/Header';
import { getAppState } from '@/lib/db';
import EventInfoModule from '@/components/admin/EventInfoModule';

export const dynamic = 'force-dynamic';

export default async function AdminEventInfoPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!session.isAdmin) redirect('/');

  return (
    <>
      <Header name={session.name} eventName={getAppState().event_name} isAdmin={session.isAdmin} />
      <main className="max-w-3xl mx-auto px-4 pt-4 pb-24">
        <div className="mb-4">
          <Link href="/admin" className="text-sm font-semibold text-brand-600 hover:text-brand-700">← All modules</Link>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1">📍 Venue & Event Info</h1>
          <p className="text-sm text-slate-500 mt-0.5">Add venue details, FAQs, emergency contacts, and instructions for attendees.</p>
        </div>
        <EventInfoModule />
      </main>
    </>
  );
}
