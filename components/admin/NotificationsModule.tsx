'use client';

import { useState } from 'react';

const QUICK = [
  { title: '🍽️ Lunch is served', body: 'Lunch is now served at the dining hall. Please head over!' },
  { title: '🏆 Award Ceremony', body: 'Award Ceremony starts in 10 minutes. Please take your seats.' },
  { title: '📸 Group Photo', body: 'Group photo session starting now at the Main Lawn!' },
  { title: '☕ Tea Break', body: 'Tea/snack break has started. See you back in 15 minutes.' },
  { title: '🎉 Event Starting', body: 'The event is about to begin! Please find your seats.' },
  { title: '🌙 Event Closing', body: 'Thank you for being part of ABHYUDAY 2026! Safe journey home.' },
];

type Target = 'all' | 'admins' | 'department';

export default function NotificationsModule({ departments = [] }: { departments?: string[] }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [target, setTarget] = useState<Target>('all');
  const [department, setDepartment] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number; total: number } | null>(null);
  const [error, setError] = useState('');

  async function send(t: string, b: string) {
    if (target === 'department' && !department) {
      setError('Please choose a department');
      return;
    }
    setSending(true);
    setError('');
    setResult(null);
    try {
      const res = await fetch('/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: t,
          body: b,
          target,
          department: target === 'department' ? department : undefined,
        }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error ?? 'Failed to send'); return; }
      setResult(d);
    } finally {
      setSending(false);
    }
  }

  const targets: { id: Target; label: string }[] = [
    { id: 'all', label: 'Everyone' },
    { id: 'department', label: 'Department' },
    { id: 'admins', label: 'Admins only' },
  ];

  const inp = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400';

  return (
    <div className="space-y-6">
      {/* Audience target */}
      <div>
        <h2 className="text-sm font-bold text-slate-700 mb-3">Send to</h2>
        <div className="flex gap-2 flex-wrap">
          {targets.map((tg) => {
            const active = target === tg.id;
            return (
              <button
                key={tg.id}
                onClick={() => setTarget(tg.id)}
                className={`px-4 py-2 rounded-full text-sm font-semibold border transition ${
                  active ? 'text-white border-transparent' : 'text-slate-600 bg-white border-slate-200 hover:border-brand-300'
                }`}
                style={active ? { background: '#FE9234' } : {}}
              >
                {tg.label}
              </button>
            );
          })}
        </div>
        {target === 'department' && (
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className={`${inp} mt-3`}
          >
            <option value="">Choose a department…</option>
            {departments.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        )}
        {target === 'department' && departments.length === 0 && (
          <p className="text-xs text-slate-400 mt-2">
            No departments set yet — attendees add theirs on the Profile screen.
          </p>
        )}
      </div>

      {/* Quick send */}
      <div>
        <h2 className="text-sm font-bold text-slate-700 mb-3">Quick Send</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {QUICK.map((q) => (
            <button
              key={q.title}
              onClick={() => send(q.title, q.body)}
              disabled={sending}
              className="text-left rounded-xl border border-slate-200 px-4 py-3 bg-white hover:bg-brand-50 hover:border-brand-300 transition disabled:opacity-50"
            >
              <p className="font-semibold text-sm text-slate-900">{q.title}</p>
              <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{q.body}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Custom compose */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <h2 className="text-sm font-bold text-slate-700">Custom Notification</h2>
        <div>
          <label className="text-xs font-semibold text-slate-600 block mb-1">Title *</label>
          <input className={inp} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Notification title" />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-600 block mb-1">Message *</label>
          <textarea rows={3} className={inp} value={body} onChange={(e) => setBody(e.target.value)} placeholder="What do you want to say?" />
        </div>
        <button
          disabled={sending || !title || !body}
          onClick={() => send(title, body)}
          className="w-full py-2.5 rounded-lg bg-brand-600 text-white font-bold text-sm hover:bg-brand-700 disabled:opacity-50 transition"
        >
          {sending
            ? 'Sending…'
            : target === 'admins'
            ? '📤 Send to admins'
            : target === 'department'
            ? `📤 Send to ${department || 'department'}`
            : '📤 Send to all attendees'}
        </button>
      </div>

      {result && (
        <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          ✅ Sent to <strong>{result.sent}</strong> of {result.total} subscribers
          {result.failed > 0 && ` (${result.failed} failed — stale subscriptions)`}
        </div>
      )}
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          ❌ {error}
        </div>
      )}

      <div className="text-xs text-slate-400 border-t border-slate-100 pt-4">
        <p className="font-semibold mb-1 text-slate-500">How it works</p>
        <p>Notifications are sent to all attendees who allowed browser notifications on their device.
        Users who blocked or haven't subscribed won't receive them.
        For native Android/iOS apps, FCM push is used instead.</p>
      </div>
    </div>
  );
}
