import Link from 'next/link';
import { adminModules } from '@/lib/admin-modules';

export const dynamic = 'force-dynamic';

export default function AdminDashboardPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">Select a module from the sidebar or the cards below.</p>
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {adminModules.map((m) =>
          m.status === 'live' && m.href ? (
            <Link
              key={m.id}
              href={m.href}
              className="group bg-white rounded-2xl border border-slate-200 p-5 hover:border-orange-300 hover:shadow-md transition"
            >
              <div className="flex items-start justify-between">
                <span className="text-3xl">{m.emoji}</span>
                <span className="text-[10px] font-bold uppercase tracking-wide bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                  Live
                </span>
              </div>
              <h2 className="mt-3 font-extrabold text-slate-900 group-hover:text-orange-600 transition text-sm">
                {m.name}
              </h2>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">{m.description}</p>
            </Link>
          ) : (
            <div
              key={m.id}
              className="bg-slate-50 rounded-2xl border border-dashed border-slate-200 p-5 opacity-60"
            >
              <span className="text-3xl grayscale">{m.emoji}</span>
              <h2 className="mt-3 font-extrabold text-slate-400 text-sm">{m.name}</h2>
              <p className="text-xs text-slate-400 mt-1">{m.description}</p>
            </div>
          )
        )}
      </div>
    </div>
  );
}
