import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/lib/auth';
import Header from '@/components/Header';
import { getAppState, getAttendance, getUserById } from '@/lib/db';
import MyQrClient from '@/components/MyQrClient';

export const dynamic = 'force-dynamic';

export default async function MePage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const appState = getAppState();
  const user = getUserById(session.id);
  const attendance = getAttendance(session.id);

  return (
    <>
      <Header name={session.name} eventName={appState.event_name} isAdmin={session.isAdmin} />
      <main className="max-w-sm mx-auto px-4 pt-4 pb-24">
        <div className="mb-5">
          <Link href="/" className="text-sm font-semibold text-brand-600 hover:text-brand-700">← Home</Link>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1">🪪 My Badge</h1>
          <p className="text-sm text-slate-500 mt-0.5">Show this QR code at the entrance</p>
        </div>
        <MyQrClient
          userId={session.id}
          name={session.name}
          email={session.email}
          department={user?.department ?? null}
          isCheckedIn={!!attendance}
          eventName={appState.event_name}
        />
      </main>
    </>
  );
}
