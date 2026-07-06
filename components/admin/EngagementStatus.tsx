'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import type { EmployeeEngagement } from '@/lib/db';

const fetcher = (url: string) => fetch(url).then(r => r.json());

type Filter = 'all' | 'not_logged_in' | 'inactive' | 'active';

const STATUS_META = {
  not_logged_in: { label: 'Not logged in', color: '#EF4444', bg: '#FEF2F2', dot: '#EF4444' },
  inactive:      { label: 'No activity',   color: '#F59E0B', bg: '#FFFBEB', dot: '#F59E0B' },
  active:        { label: 'Active',         color: '#10B981', bg: '#ECFDF5', dot: '#10B981' },
};

export default function EngagementStatus() {
  const [open, setOpen]     = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');

  const { data, isLoading, mutate } = useSWR<{ rows: EmployeeEngagement[] }>(
    open ? '/api/admin/engagement' : null, fetcher
  );

  const rows = data?.rows ?? [];
  const counts = {
    not_logged_in: rows.filter(r => r.status === 'not_logged_in').length,
    inactive:      rows.filter(r => r.status === 'inactive').length,
    active:        rows.filter(r => r.status === 'active').length,
  };

  const visible = rows.filter(r => {
    if (filter !== 'all' && r.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q) || (r.department ?? '').toLowerCase().includes(q);
    }
    return true;
  });

  function exportCsv() {
    if (!rows.length) return;
    const header = 'Name,Email,Department,Status,Logged In At,Activities';
    const lines = visible.map(r =>
      `"${r.name}","${r.email}","${r.department ?? ''}","${STATUS_META[r.status].label}","${r.logged_in_at ?? ''}","${r.activity_count}"`
    );
    const blob = new Blob([[header, ...lines].join('\n')], { type: 'text/csv' });
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob), download: 'engagement.csv',
    });
    a.click(); URL.revokeObjectURL(a.href);
  }

  return (
    <div className="mt-8 border border-slate-200 rounded-2xl overflow-hidden">
      {/* Toggle header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 bg-slate-50 hover:bg-slate-100 transition"
      >
        <div className="flex items-center gap-2">
          <span className="text-base">📊</span>
          <span className="font-bold text-slate-700 text-sm">Engagement Status</span>
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-600">
            Who hasn't logged in or interacted
          </span>
        </div>
        {open ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
      </button>

      {open && (
        <div className="p-4 space-y-4">

          {/* Summary chips */}
          {!isLoading && rows.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {(['all', 'not_logged_in', 'inactive', 'active'] as Filter[]).map(f => {
                const count = f === 'all' ? rows.length : counts[f];
                const meta  = f === 'all' ? null : STATUS_META[f];
                return (
                  <button key={f} onClick={() => setFilter(f)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition"
                    style={{
                      background:  filter === f ? (meta?.bg ?? '#F1F5F9') : 'white',
                      borderColor: filter === f ? (meta?.color ?? '#94A3B8') : '#E2E8F0',
                      color:       filter === f ? (meta?.color ?? '#475569') : '#64748B',
                    }}>
                    {meta && (
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: meta.dot }} />
                    )}
                    {f === 'all' ? 'All' : meta!.label} ({count})
                  </button>
                );
              })}
            </div>
          )}

          {/* Toolbar */}
          <div className="flex gap-2">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name, email, department…"
              className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
            />
            <button onClick={() => mutate()}
              className="flex items-center gap-1 text-xs font-semibold text-slate-500 border border-slate-200 px-3 py-2 rounded-xl hover:bg-slate-50 transition">
              <RefreshCw size={12} /> Refresh
            </button>
            {visible.length > 0 && (
              <button onClick={exportCsv}
                className="text-xs font-bold border px-3 py-2 rounded-xl hover:bg-slate-50 transition"
                style={{ color: '#FE9234', borderColor: '#FED7AA' }}>
                ↓ CSV
              </button>
            )}
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="flex items-center justify-center py-10 text-slate-400 gap-2 text-sm">
              <RefreshCw size={14} className="animate-spin" /> Loading…
            </div>
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-slate-400">
              <span className="text-3xl mb-2">👥</span>
              <p className="font-semibold text-sm">No employees match</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-3 py-2.5 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wide">#</th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wide">Name</th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wide">Department</th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wide">Status</th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wide">Logged in</th>
                    <th className="px-3 py-2.5 text-center text-[11px] font-bold text-slate-400 uppercase tracking-wide">Activities</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r, i) => {
                    const meta = STATUS_META[r.status];
                    return (
                      <tr key={r.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                        <td className="px-3 py-2.5 text-xs text-slate-400 font-semibold">{i + 1}</td>
                        <td className="px-3 py-2.5">
                          <p className="text-xs font-semibold text-slate-800">{r.name}</p>
                          <p className="text-[11px] text-slate-400">{r.email}</p>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-slate-500">{r.department ?? '—'}</td>
                        <td className="px-3 py-2.5">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold"
                            style={{ background: meta.bg, color: meta.color }}>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.dot }} />
                            {meta.label}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-[11px] text-slate-400">
                          {r.logged_in_at ? new Date(r.logged_in_at).toLocaleString() : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span className={`text-xs font-bold ${r.activity_count > 0 ? 'text-slate-700' : 'text-slate-300'}`}>
                            {r.activity_count}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
