import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { adminModules } from '@/lib/admin-modules';
import Header from '@/components/Header';
import { getAppState } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!session.isAdmin) redirect('/');

  return (
    <>
      <Header name={session.name} eventName={getAppState().event_name} isAdmin={session.isAdmin} />
      <main className="max-w-5xl mx-auto px-4 pt-6 pb-24">
        <div className="mb-6">
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">Admin · Modules</h1>
          <p className="text-sm text-slate-500 mt-1">
            Pick a module to manage. More interactive modules are coming in the next phase.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {adminModules.map((m) =>
            m.status === 'live' && m.href ? (
              <Link
                key={m.id}
                href={m.href}
                className="group bg-white rounded-2xl border border-slate-200 p-5 hover:border-brand-400 hover:shadow-lg hover:shadow-brand-100 transition"
              >
                <div className="flex items-start justify-between">
                  <span className="text-3xl">{m.emoji}</span>
                  <span className="text-[10px] font-bold uppercase tracking-wide bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                    Live
                  </span>
                </div>
                <h2 className="mt-3 font-extrabold text-slate-900 group-hover:text-brand-700 transition">
                  {m.name}
                </h2>
                <p className="text-sm text-slate-500 mt-1">{m.description}</p>
                <p className="mt-3 text-sm font-bold text-brand-600">Open →</p>
              </Link>
            ) : (
              <div
                key={m.id}
                className="bg-white/60 rounded-2xl border border-dashed border-slate-300 p-5 opacity-75"
              >
                <div className="flex items-start justify-between">
                  <span className="text-3xl grayscale">{m.emoji}</span>
                  <span className="text-[10px] font-bold uppercase tracking-wide bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                    Next phase
                  </span>
                </div>
                <h2 className="mt-3 font-extrabold text-slate-500">{m.name}</h2>
                <p className="text-sm text-slate-400 mt-1">{m.description}</p>
              </div>
            )
          )}
        </div>
      </main>
    </>
  );
}
