import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import Header from '@/components/Header';
import { getAppState } from '@/lib/db';
import AppControlModule from '@/components/admin/AppControlModule';

export const dynamic = 'force-dynamic';

export default async function AppControlPage() {
  const session = await getSession();
  if (!session?.isAdmin) redirect('/');

  const appState = getAppState();

  return (
    <>
      <Header eventName={appState.event_name} title="App Control" isAdmin={true} />
      <main className="max-w-6xl mx-auto px-4 pt-6 pb-10">
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold text-slate-900">⚙️ App Control</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage homepage visibility, module access, data resets, and push notification status.
          </p>
        </div>
        <AppControlModule />
      </main>
    </>
  );
}
