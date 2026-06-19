'use client';

import { useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import { motion, AnimatePresence } from 'framer-motion';
import { useRealtime } from '../useRealtime';
import type { CandidateWithVotes, AppState, Gender, VotingState } from '@/lib/types';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface StatsResponse {
  stats: { totalVotes: number; totalUsers: number; voters: number };
  topMale: CandidateWithVotes[];
  topFemale: CandidateWithVotes[];
  state: AppState;
}

type AdminTab = 'control' | 'candidates';

export default function VotingModule() {
  const [tab, setTab] = useState<AdminTab>('control');
  const [toast, setToast] = useState('');

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  return (
    <div>
      <div className="flex gap-2 mb-5">
        {(
          [
            ['control', '🎛️ Voting Control'],
            ['candidates', '👥 Candidates'],
          ] as [AdminTab, string][]
        ).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-2xl py-3 text-sm sm:text-base font-bold transition ${
              tab === t
                ? 'bg-slate-900 text-white shadow-lg'
                : 'bg-white text-slate-600 border border-slate-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'control' ? <ControlTab notify={notify} /> : <CandidatesTab notify={notify} />}

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-sm font-semibold px-5 py-3 rounded-full shadow-xl max-w-[90vw] text-center"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------------- Voting Control + live stats ---------------- */

const stateMeta: Record<VotingState, { label: string; color: string; emoji: string }> = {
  not_started: { label: 'Not started', color: 'bg-slate-200 text-slate-700', emoji: '⏳' },
  live: { label: 'LIVE', color: 'bg-green-100 text-green-700', emoji: '🟢' },
  paused: { label: 'Paused', color: 'bg-amber-100 text-amber-700', emoji: '⏸️' },
  ended: { label: 'Ended', color: 'bg-red-100 text-red-700', emoji: '🏁' },
};

function ControlTab({ notify }: { notify: (msg: string) => void }) {
  useRealtime(['/api/admin/stats']);
  const { data, mutate } = useSWR<StatsResponse>('/api/admin/stats', fetcher, {
    refreshInterval: 15000,
  });
  const [busy, setBusy] = useState(false);

  async function doAction(action: string, confirmMsg?: string) {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setBusy(true);
    try {
      const res = await fetch('/api/admin/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const body = await res.json();
      notify(res.ok ? `Done — ${action} ✅` : (body.error ?? 'Action failed'));
      mutate();
    } finally {
      setBusy(false);
    }
  }

  if (!data) return <Spinner />;

  const { state, stats } = data;
  const vs = state.voting_state;
  const meta = stateMeta[vs];

  const btn = (
    label: string,
    action: string,
    enabled: boolean,
    style: string,
    confirmMsg?: string
  ) => (
    <button
      onClick={() => doAction(action, confirmMsg)}
      disabled={!enabled || busy}
      className={`rounded-2xl py-4 px-4 font-bold text-base transition active:scale-[0.97] disabled:opacity-35 disabled:cursor-not-allowed ${style}`}
    >
      {label}
    </button>
  );

  const round = state.voting_round;

  return (
    <div className="space-y-5">
      <EventNameCard current={state.event_name} notify={notify} onSaved={() => mutate()} />

      {/* Current round + state */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
              {round === 1 ? 'Round 1 · Qualifier' : 'Round 2 · Grand Finale'}
            </p>
            <p className="text-2xl font-black text-slate-900 mt-0.5">
              {meta.emoji} {meta.label}
            </p>
          </div>
          <span className={`px-3 py-1.5 rounded-full text-sm font-bold ${meta.color} ${vs === 'live' ? 'animate-pulse' : ''}`}>
            {meta.label}
          </span>
        </div>
        <p className="mt-3 text-xs text-slate-500 bg-slate-50 rounded-xl px-3 py-2">
          {round === 1
            ? '🔎 Employees vote for 1 male & 1 female from the full pool — counts stay hidden from them. After ending Round 1 you review the ranked results and choose how many advance.'
            : '🏆 Finalists only, one vote per category, live leaderboard visible to everyone. Finalists were promoted from the Round-1 votes.'}
        </p>
      </div>

      {/* State machine buttons */}
      <div className="grid grid-cols-2 gap-3">
        {btn('▶️ Start Voting', 'start', vs === 'not_started', 'bg-green-600 text-white hover:bg-green-700')}
        {vs === 'paused'
          ? btn('▶️ Resume', 'resume', true, 'bg-green-600 text-white hover:bg-green-700')
          : btn('⏸️ Pause', 'pause', vs === 'live', 'bg-amber-500 text-white hover:bg-amber-600')}
        {btn(
          '🏁 End Voting',
          'end',
          vs === 'live' || vs === 'paused',
          'bg-red-600 text-white hover:bg-red-700',
          round === 1
            ? 'End Round 1? Voting closes and you can then review the results and promote the top finalists.'
            : 'End voting? Employees will no longer be able to vote.'
        )}
        {btn('🔄 Reset All', 'reset', true, 'bg-slate-200 text-slate-700 hover:bg-slate-300', 'Reset voting state to "not started"? (Votes are kept; results flag is cleared.)')}
      </div>

      {/* Round-1 results: promote panel after R1 ends, read-only reference in R2 */}
      {((round === 1 && vs === 'ended') || round === 2) && (
        <Round1Results mode={round === 1 ? 'promote' : 'view'} notify={notify} onPromoted={() => mutate()} />
      )}

      {/* Announce (round 2 only) */}
      {round === 2 && (
        <>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() =>
              doAction('announce', 'Announce results to ALL employees? This reveals the winners with full fanfare! 🎉')
            }
            disabled={vs !== 'ended' || state.results_announced || busy}
            className="w-full rounded-2xl py-5 text-lg font-black text-white bg-gradient-to-r from-amber-500 via-pink-500 to-purple-600 shadow-xl shadow-pink-200 disabled:opacity-35 disabled:cursor-not-allowed"
          >
            {state.results_announced ? '🎉 Results Announced!' : '🎉 Announce Results'}
          </motion.button>
          {vs !== 'ended' && !state.results_announced && (
            <p className="text-xs text-slate-400 text-center -mt-2">
              End voting first to unlock the announcement
            </p>
          )}
          <button
            onClick={() =>
              doAction('back_to_round1', 'Go back to Round 1? The qualifier reopens (paused) — ending it again re-runs the automatic top-10 promotion.')
            }
            disabled={busy}
            className="w-full rounded-xl border border-slate-300 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100"
          >
            ↩ Back to Round 1 (qualifier)
          </button>
        </>
      )}

      {/* Live stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label={`R${round} votes`} value={stats.totalVotes} emoji="🗳️" />
        <StatCard label="Voters" value={stats.voters} emoji="🙋" />
        <StatCard label="Signed up" value={stats.totalUsers} emoji="👤" />
      </div>

      <TopFive title={`🤵 Top 10 — Male (round ${round})`} list={data.topMale} />
      <TopFive title={`👸 Top 10 — Female (round ${round})`} list={data.topFemale} />
    </div>
  );
}

/* ---------------- Round-1 results: ranked lists, CSV download, top-N promotion ---------------- */

interface Round1ResultsResponse {
  male: CandidateWithVotes[];
  female: CandidateWithVotes[];
}

function Round1Results({
  mode,
  notify,
  onPromoted,
}: {
  mode: 'promote' | 'view';
  notify: (msg: string) => void;
  onPromoted: () => void;
}) {
  const { data } = useSWR<Round1ResultsResponse>('/api/admin/round1-results', fetcher);
  const [maleCount, setMaleCount] = useState(10);
  const [femaleCount, setFemaleCount] = useState(10);
  const [busy, setBusy] = useState(false);

  if (!data) return <Spinner />;

  async function promote() {
    if (
      !window.confirm(
        `Promote the top ${maleCount} male + top ${femaleCount} female (by votes) to the Grand Finale? Ties at the cutoff are included.`
      )
    )
      return;
    setBusy(true);
    try {
      const res = await fetch('/api/admin/round1-results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maleCount, femaleCount }),
      });
      const body = await res.json();
      notify(
        res.ok
          ? `🏆 ${body.finalists.male.length} + ${body.finalists.female.length} finalists promoted — Round 2 is ready!`
          : (body.error ?? 'Promotion failed')
      );
      if (res.ok) onPromoted();
    } finally {
      setBusy(false);
    }
  }

  const column = (title: string, list: CandidateWithVotes[], topN: number) => (
    <div className="min-w-0">
      <h4 className="font-bold text-slate-900 text-sm mb-2">{title}</h4>
      <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
        {list.map((c, i) => {
          const advancing = mode === 'promote' ? i < topN : !!c.is_finalist;
          return (
            <div
              key={c.id}
              className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 ${
                advancing ? 'border-brand-300 bg-brand-50/60' : 'border-slate-100'
              } ${c.vote_count === 0 ? 'opacity-60' : ''}`}
            >
              <span className="w-6 text-center text-xs font-bold text-slate-400 shrink-0">{i + 1}</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={c.image_url}
                alt={c.name}
                className="w-7 h-7 rounded-full object-cover bg-slate-100 shrink-0"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(c.name)}`;
                }}
              />
              <span className="flex-1 min-w-0 text-sm font-semibold text-slate-800 truncate">
                {c.name}
                {advancing && <span className="ml-1.5 text-[10px] font-bold text-brand-600 uppercase">→ R2</span>}
              </span>
              <span className="shrink-0 text-xs font-bold text-brand-600">{c.vote_count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className={`bg-white rounded-2xl p-5 ${mode === 'promote' ? 'border-2 border-brand-200' : 'border border-slate-200'}`}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="font-extrabold text-slate-900">
          📋 Round 1 results {mode === 'view' && <span className="text-slate-400 font-semibold">(qualifier)</span>}
        </h3>
        <a
          href="/api/admin/round1-results?format=csv"
          download
          className="rounded-xl bg-slate-900 text-white px-4 py-2 text-sm font-bold hover:bg-slate-700"
        >
          ⬇️ Download CSV
        </a>
      </div>
      <p className="text-xs text-slate-500 mt-1 mb-4">
        {mode === 'promote'
          ? 'Ranked by votes. Choose how many advance per category — highlighted rows go to the Grand Finale (ties at the cutoff are included).'
          : 'Final qualifier standings — highlighted rows were promoted to the finale.'}
      </p>

      {mode === 'promote' && (
        <div className="flex items-end gap-3 flex-wrap mb-4">
          <label className="text-sm font-semibold text-slate-600">
            Top male
            <input
              type="number"
              min={1}
              max={50}
              value={maleCount}
              onChange={(e) => setMaleCount(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
              className="block mt-1 w-24 rounded-xl border border-slate-300 px-3 py-2 font-bold focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </label>
          <label className="text-sm font-semibold text-slate-600">
            Top female
            <input
              type="number"
              min={1}
              max={50}
              value={femaleCount}
              onChange={(e) => setFemaleCount(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
              className="block mt-1 w-24 rounded-xl border border-slate-300 px-3 py-2 font-bold focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </label>
          <button
            onClick={promote}
            disabled={busy}
            className="flex-1 min-w-[200px] rounded-xl py-3 px-4 font-black text-white bg-gradient-to-r from-brand-600 to-purple-600 hover:opacity-95 disabled:opacity-40"
          >
            {busy ? 'Promoting…' : `🚀 Promote top ${maleCount} + ${femaleCount} to Round 2`}
          </button>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        {column('🤵 Male', data.male, maleCount)}
        {column('👸 Female', data.female, femaleCount)}
      </div>
    </div>
  );
}

function EventNameCard({
  current,
  notify,
  onSaved,
}: {
  current: string;
  notify: (msg: string) => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(current);
  const [saving, setSaving] = useState(false);
  const prev = useRef(current);

  // Sync local input if the value changes elsewhere (another admin / realtime)
  useEffect(() => {
    if (current !== prev.current) {
      prev.current = current;
      setName(current);
    }
  }, [current]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventName: name }),
      });
      const body = await res.json();
      notify(res.ok ? 'Event name updated ✅' : (body.error ?? 'Save failed'));
      if (res.ok) onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="bg-white rounded-2xl border border-slate-200 p-5">
      <label htmlFor="event-name" className="text-xs font-bold uppercase tracking-wide text-slate-400">
        Event name <span className="normal-case font-semibold">(shown on voting & results pages)</span>
      </label>
      <div className="flex gap-3 mt-2">
        <input
          id="event-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          required
          className="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <button
          type="submit"
          disabled={saving || name.trim() === current}
          className="rounded-xl bg-brand-600 px-5 font-bold text-white hover:bg-brand-700 disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}

function StatCard({ label, value, emoji }: { label: string; value: number; emoji: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 text-center">
      <div className="text-xl">{emoji}</div>
      <div className="text-2xl font-black text-slate-900">{value}</div>
      <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">{label}</div>
    </div>
  );
}

function TopFive({ title, list }: { title: string; list: CandidateWithVotes[] }) {
  if (list.length === 0) return null;
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4">
      <h3 className="font-bold text-slate-900 mb-3">{title}</h3>
      <div className="space-y-2">
        {list.map((c, i) => (
          <div key={c.id} className="flex items-center gap-3 text-sm">
            <span className="w-5 text-center font-bold text-slate-400">{i + 1}</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={c.image_url}
              alt={c.name}
              className="w-8 h-8 rounded-full object-cover bg-slate-100"
              onError={(e) => {
                (e.target as HTMLImageElement).src =
                  `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(c.name)}`;
              }}
            />
            <span className="flex-1 font-semibold text-slate-800 truncate">{c.name}</span>
            <span className="font-bold text-brand-600">{c.vote_count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Candidates management ---------------- */

interface CandidatesResponse {
  candidates: CandidateWithVotes[];
}

interface CsvReport {
  added: number;
  total: number;
  report: { row: number; name: string; status: 'added' | 'error'; message?: string }[];
}

const emptyForm = { id: 0, name: '', gender: 'male' as Gender | '', imageUrl: '', email: '' };

function CandidatesTab({ notify }: { notify: (msg: string) => void }) {
  useRealtime(['/api/admin/candidates']);
  const { data, mutate } = useSWR<CandidatesResponse>('/api/admin/candidates', fetcher);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [csvReport, setCsvReport] = useState<CsvReport | null>(null);
  const [search, setSearch] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const editing = form.id !== 0;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, id: editing ? form.id : undefined, gender: form.gender || null };
      const res = await fetch('/api/admin/candidates', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) {
        notify(body.error ?? 'Save failed');
        return;
      }
      notify(editing ? 'Candidate updated ✅' : `${form.name} added ✅`);
      setForm(emptyForm);
      mutate();
    } finally {
      setSaving(false);
    }
  }

  async function remove(c: CandidateWithVotes) {
    if (!window.confirm(`Delete ${c.name}? Their ${c.vote_count} vote(s) will be removed too.`)) return;
    const res = await fetch('/api/admin/candidates', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: c.id }),
    });
    notify(res.ok ? `${c.name} deleted` : 'Delete failed');
    mutate();
  }

  async function uploadCsv(file: File) {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/admin/candidates/csv', { method: 'POST', body: fd });
    const body = await res.json();
    if (!res.ok) {
      notify(body.error ?? 'CSV upload failed');
      return;
    }
    setCsvReport(body);
    notify(`CSV processed: ${body.added}/${body.total} added`);
    mutate();
    if (fileRef.current) fileRef.current.value = '';
  }

  if (!data) return <Spinner />;

  return (
    <div className="space-y-5">
      {/* Add / edit form */}
      <form onSubmit={save} className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
        <h3 className="font-bold text-slate-900">{editing ? `Edit: ${form.name}` : 'Add candidate'}</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <input
            placeholder="Full name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            className="rounded-xl border border-slate-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <select
            value={form.gender}
            onChange={(e) => setForm({ ...form, gender: e.target.value as Gender | '' })}
            className="rounded-xl border border-slate-300 px-4 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="">— gender not set (off ballot) —</option>
          </select>
        </div>
        <input
          type="email"
          placeholder="Email (optional — links to the employee, prevents duplicates)"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="w-full rounded-xl border border-slate-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <div className="flex gap-3 items-start">
          <input
            placeholder="Image URL (https://…)"
            value={form.imageUrl}
            onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
            required
            className="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {form.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={form.imageUrl}
              alt="preview"
              className="w-11 h-11 rounded-full object-cover border border-slate-200 bg-slate-50"
              onError={(e) => ((e.target as HTMLImageElement).style.opacity = '0.2')}
              onLoad={(e) => ((e.target as HTMLImageElement).style.opacity = '1')}
            />
          )}
        </div>
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 rounded-xl bg-brand-600 py-3 font-bold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {saving ? 'Saving…' : editing ? 'Update candidate' : '+ Add candidate'}
          </button>
          {editing && (
            <button
              type="button"
              onClick={() => setForm(emptyForm)}
              className="rounded-xl border border-slate-300 px-4 font-semibold text-slate-600"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      {/* CSV upload */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h3 className="font-bold text-slate-900">Bulk upload (CSV)</h3>
        <p className="text-xs text-slate-500 mt-1 mb-3">
          Columns: <code className="bg-slate-100 px-1.5 py-0.5 rounded">name, gender, image_url, email</code> — header
          optional. Gender is male/female (or blank = off ballot). Rows with an email update the existing
          candidate instead of duplicating — works with auto-imported employees too.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) uploadCsv(f);
          }}
          className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-xl file:border-0 file:bg-brand-50 file:px-4 file:py-2.5 file:font-bold file:text-brand-700 hover:file:bg-brand-100"
        />
        {csvReport && (
          <div className="mt-3 max-h-44 overflow-y-auto rounded-xl bg-slate-50 p-3 text-xs space-y-1">
            {csvReport.report.map((r, i) => (
              <div key={i} className={r.status === 'added' ? 'text-green-700' : 'text-red-600'}>
                Row {r.row}: {r.status === 'added' ? `✓ ${r.name} added` : `✗ ${r.message}`}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Candidate list */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <h3 className="font-bold text-slate-900">All candidates ({data.candidates.length})</h3>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 Search name or email…"
            className="flex-1 min-w-[180px] max-w-xs rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        {data.candidates.length === 0 ? (
          <p className="text-sm text-slate-400">No candidates yet — add some above.</p>
        ) : (
          (() => {
            const q = search.trim().toLowerCase();
            const filtered = q
              ? data.candidates.filter(
                  (c) => c.name.toLowerCase().includes(q) || (c.email ?? '').toLowerCase().includes(q)
                )
              : data.candidates;
            if (filtered.length === 0) {
              return <p className="text-sm text-slate-400">No match for “{search}”.</p>;
            }
            return (
          <div className="space-y-2">
            {filtered.map((c) => (
              <div key={c.id} className="flex items-center gap-3 rounded-xl border border-slate-100 p-2.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={c.image_url}
                  alt={c.name}
                  className="w-10 h-10 rounded-full object-cover bg-slate-100"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(c.name)}`;
                  }}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 truncate">
                    {c.is_finalist ? '⭐ ' : ''}
                    {c.name}
                  </p>
                  <p className="text-xs text-slate-400 truncate">
                    {c.gender === 'male' ? '🤵 Male' : c.gender === 'female' ? '👸 Female' : '⚠️ No gender — off ballot'} ·{' '}
                    {c.vote_count} votes
                    {c.email ? ` · ${c.email}` : ''}
                  </p>
                </div>
                <button
                  onClick={() =>
                    setForm({
                      id: c.id,
                      name: c.name,
                      gender: c.gender ?? '',
                      imageUrl: c.image_url,
                      email: c.email ?? '',
                    })
                  }
                  className="text-sm font-semibold text-brand-600 hover:bg-brand-50 px-3 py-1.5 rounded-lg"
                >
                  Edit
                </button>
                <button
                  onClick={() => remove(c)}
                  className="text-sm font-semibold text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
            );
          })()
        )}
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex justify-center py-16">
      <div className="w-10 h-10 rounded-full border-4 border-brand-200 border-t-brand-600 animate-spin" />
    </div>
  );
}
