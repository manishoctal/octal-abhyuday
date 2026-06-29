'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { AnimatePresence, motion } from 'framer-motion';
import { useRealtime } from '../useRealtime';
import type { QaSession, QaSessionKind } from '@/lib/types';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type SessionRow = QaSession & { question_count: number };

const meta: Record<'poll' | 'ranking', { emoji: string; noun: string; optionsHint: string }> = {
  poll: {
    emoji: '📊',
    noun: 'poll',
    optionsHint: 'One choice per line (2–8)\ne.g.\nPizza party 🍕\nMovie night 🎬\nGo-karting 🏎️',
  },
  ranking: {
    emoji: '🏅',
    noun: 'ranking',
    optionsHint: 'One item per line (2–8) — the crowd ranks them\ne.g.\nDance performance\nSinging\nStand-up comedy',
  },
};

/** Shared admin UI for the Polls and Rankings modules: type a question,
 *  hit Launch, and it's instantly live on every phone. */
export default function QuickLaunch({ kind }: { kind: Extract<QaSessionKind, 'poll' | 'ranking'> }) {
  useRealtime(['/api/admin/qa/sessions']);
  const { data, mutate } = useSWR<{ sessions: SessionRow[] }>('/api/admin/qa/sessions', fetcher, {
    refreshInterval: 15000,
  });
  const [prompt, setPrompt] = useState('');
  const [optionsText, setOptionsText] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const m = meta[kind];
  const mine = (data?.sessions ?? []).filter((s) => s.kind === kind);
  const active = mine.find((s) => s.status === 'live');
  const anyLive = (data?.sessions ?? []).find((s) => s.status === 'live');

  async function launch(e: React.FormEvent) {
    e.preventDefault();
    if (anyLive && !window.confirm(`"${anyLive.title}" is currently live and will be ended. Launch this ${m.noun} now?`)) {
      return;
    }
    setBusy(true);
    try {
      const options = optionsText.split('\n').map((s) => s.trim()).filter(Boolean);
      const res = await fetch('/api/admin/qa/launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, prompt, options }),
      });
      const body = await res.json();
      if (!res.ok) {
        notify(body.error ?? 'Launch failed');
        return;
      }
      notify(`${m.emoji} Live on everyone's screen!`);
      setPrompt('');
      setOptionsText('');
      mutate();
    } finally {
      setBusy(false);
    }
  }

  async function endActive(s: SessionRow) {
    if (!window.confirm(`End this ${m.noun}? Final results will stay visible to everyone.`)) return;
    const res = await fetch('/api/admin/qa/present', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'end_session', sessionId: s.id }),
    });
    notify(res.ok ? `${m.noun[0].toUpperCase() + m.noun.slice(1)} ended — results locked in ✅` : 'Failed to end');
    mutate();
  }

  async function remove(s: SessionRow) {
    if (!window.confirm(`Delete "${s.title}" and its responses?`)) return;
    const res = await fetch('/api/admin/qa/sessions', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: s.id }),
    });
    notify(res.ok ? 'Deleted' : 'Delete failed');
    mutate();
  }

  if (!data) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-10 h-10 rounded-full border-4 border-brand-200 border-t-brand-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="grid lg:grid-cols-[400px_1fr] gap-6 items-start">

      {/* ── Left: launch form ───────────────────────── */}
      <div className="space-y-4 lg:sticky lg:top-6">
        {/* Active banner */}
        {active && (
          <div className="bg-green-50 border border-green-300 rounded-2xl p-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-green-600 animate-pulse mb-1">● Live now</p>
            <p className="font-extrabold text-slate-900 truncate mb-3">{active.title}</p>
            <div className="flex gap-2">
              <a href="/stage" target="_blank" rel="noreferrer"
                className="flex-1 text-center rounded-xl bg-slate-900 text-white px-3 py-2 text-sm font-bold hover:bg-slate-700">
                🖥️ Stage
              </a>
              <button onClick={() => endActive(active)}
                className="flex-1 rounded-xl bg-red-600 text-white px-3 py-2 text-sm font-bold hover:bg-red-700">
                🏁 End
              </button>
            </div>
          </div>
        )}

        <form onSubmit={launch} className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
          <h3 className="font-bold text-slate-900">{m.emoji} Launch a {m.noun}</h3>
          <input
            placeholder={kind === 'poll' ? 'Poll question…' : 'What should everyone rank?'}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            required maxLength={300}
            className="w-full rounded-xl border border-slate-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
          />
          <textarea
            placeholder={m.optionsHint}
            value={optionsText}
            onChange={(e) => setOptionsText(e.target.value)}
            rows={5} required
            className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <p className="text-xs text-slate-500">
            {kind === 'poll' ? '📊 Results appear live as people vote.' : '🏅 Everyone ranks; crowd order forms live.'}
          </p>
          <button type="submit" disabled={busy}
            className="w-full rounded-xl bg-gradient-to-r from-brand-600 to-purple-600 text-white py-3 font-black text-sm hover:opacity-95 disabled:opacity-50">
            {busy ? 'Launching…' : `🚀 Launch ${m.noun} live`}
          </button>
        </form>
      </div>

      {/* ── Right: history ──────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h3 className="font-bold text-slate-900 mb-3">Previous {m.noun}s</h3>
        {mine.filter((s) => s.status !== 'live').length === 0 ? (
          <p className="text-sm text-slate-400 py-6 text-center">No previous {m.noun}s yet.</p>
        ) : (
          <div className="space-y-2">
            {mine.filter((s) => s.status !== 'live').map((s) => (
              <div key={s.id} className="flex items-center gap-3 rounded-xl border border-slate-100 px-4 py-3 hover:bg-slate-50 transition">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 truncate text-sm">{s.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{s.question_count} options · {s.status}</p>
                </div>
                <button onClick={() => remove(s)}
                  className="shrink-0 text-xs font-semibold text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-lg border border-red-100">
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 24 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-sm font-semibold px-5 py-3 rounded-full shadow-xl max-w-[90vw] text-center"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
