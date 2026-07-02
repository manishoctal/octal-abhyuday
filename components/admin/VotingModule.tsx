'use client';

import { useEffect, useRef, useState } from 'react';
import useSWR, { mutate as globalMutate } from 'swr';
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

export default function VotingModule() {
  const [toast, setToast] = useState('');

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  return (
    <div>
      <ControlTab notify={notify} />

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
  const [syncing, setSyncing] = useState(false);

  async function syncPhotos() {
    setSyncing(true);
    try {
      const res = await fetch('/api/admin/candidates/sync-photos', { method: 'POST' });
      const body = await res.json();
      notify(res.ok ? `Photos synced — ${body.updated} candidates updated ✅` : (body.error ?? 'Sync failed'));
    } finally {
      setSyncing(false);
    }
  }

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
  const totalRounds = state.total_rounds;
  const isFinalRound = round === totalRounds;

  const roundLabel = isFinalRound
    ? `Round ${round} of ${totalRounds} · Grand Finale`
    : round === 1
      ? `Round 1 of ${totalRounds} · Qualifier`
      : `Round ${round} of ${totalRounds} · Semi-Final`;

  return (
    <div className="grid lg:grid-cols-[420px_1fr] gap-6 items-start">

      {/* ── Left: controls ───────────────────────────── */}
      <div className="space-y-4 lg:sticky lg:top-6">
        <EventNameCard current={state.event_name} notify={notify} onSaved={() => mutate()} />
        <RoundsConfigCard current={totalRounds} currentRound={round} notify={notify} onSaved={() => mutate()} />

        {/* Current round + state */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{roundLabel}</p>
              <p className="text-2xl font-black text-slate-900 mt-0.5">{meta.emoji} {meta.label}</p>
            </div>
            <span className={`px-3 py-1.5 rounded-full text-sm font-bold ${meta.color} ${vs === 'live' ? 'animate-pulse' : ''}`}>
              {meta.label}
            </span>
          </div>
          <p className="text-xs text-slate-500 bg-slate-50 rounded-xl px-3 py-2">
            {isFinalRound
              ? '🏆 Finalists only — live leaderboard visible to all.'
              : round === 1
                ? '🔎 Full pool — counts hidden. Pick who advances after voting ends.'
                : `🔎 Promoted candidates only — choose who advances to Round ${round + 1}.`}
          </p>
        </div>

        {/* State machine buttons */}
        <div className="grid grid-cols-2 gap-2">
          {btn('▶️ Start', 'start', vs === 'not_started', 'bg-green-600 text-white hover:bg-green-700')}
          {vs === 'paused'
            ? btn('▶️ Resume', 'resume', true, 'bg-green-600 text-white hover:bg-green-700')
            : btn('⏸️ Pause', 'pause', vs === 'live', 'bg-amber-500 text-white hover:bg-amber-600')}
          {btn('🏁 End', 'end', vs === 'live' || vs === 'paused', 'bg-red-600 text-white hover:bg-red-700',
            isFinalRound
              ? 'End Grand Finale voting?'
              : `End Round ${round} voting?`
          )}
          {btn('🔄 Reset', 'reset', true, 'bg-slate-200 text-slate-700 hover:bg-slate-300',
            'Full reset: clears ALL votes, finalists, and results. Cannot be undone. Continue?'
          )}
        </div>

        {/* Sync candidate photos from employee roster */}
        <button
          onClick={syncPhotos}
          disabled={syncing}
          className="w-full rounded-xl border border-slate-200 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-50 flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {syncing ? '⏳ Syncing…' : '🖼️ Sync Photos from Employee Roster'}
        </button>

        {/* Announce (final round only) */}
        {isFinalRound && (
          <div className="space-y-2">
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => doAction('announce', 'Announce results to ALL employees? 🎉')}
              disabled={vs !== 'ended' || state.results_announced || busy}
              className="w-full rounded-2xl py-4 text-base font-black text-white bg-gradient-to-r from-amber-500 via-pink-500 to-purple-600 shadow-lg disabled:opacity-35 disabled:cursor-not-allowed"
            >
              {state.results_announced ? '🎉 Results Announced!' : '🎉 Announce Results'}
            </motion.button>
            {vs !== 'ended' && !state.results_announced && (
              <p className="text-xs text-slate-400 text-center">End voting first</p>
            )}
            <button
              onClick={() => doAction('back_to_round1', `Go back to Round 1? All ${totalRounds} rounds will need to re-run.`)}
              disabled={busy}
              className="w-full rounded-xl border border-slate-300 py-2 text-sm font-bold text-slate-500 hover:bg-slate-50"
            >
              ↩ Back to Round 1
            </button>
          </div>
        )}
      </div>

      {/* ── Right: live data ─────────────────────────── */}
      <div className="space-y-5">
        {/* Live stats */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard label={`Round ${round}${totalRounds > 1 ? ` of ${totalRounds}` : ''} votes`} value={stats.totalVotes} emoji="🗳️" />
          <StatCard label="Voted so far" value={stats.voters} emoji="🙋" />
        </div>

        {/* Redo round — discard this round's votes and re-pick finalists */}
        {vs === 'ended' && (
          <button
            onClick={() => doAction('redo_round', round === 1 ? `Discard all Round 1 votes and restart voting from scratch?` : `Discard all Round ${round} votes and re-select the Round ${round - 1} finalists with a new count?`)}
            disabled={busy}
            className="w-full rounded-xl border border-amber-300 bg-amber-50 py-2 text-sm font-bold text-amber-700 hover:bg-amber-100 disabled:opacity-40 transition"
          >
            ↩ {round === 1 ? 'Restart Round 1 Voting' : `Re-do Round ${round} Selection`}
          </button>
        )}

        {/* Promote panel */}
        {!isFinalRound && (vs === 'ended' || round > 1) && (
          <RoundResults
            mode={vs === 'ended' || (vs === 'not_started' && round > 1) ? 'promote' : 'view'}
            notify={notify}
            onPromoted={() => mutate()}
          />
        )}
        {isFinalRound && (
          <RoundResults
            mode={vs === 'not_started' ? 'promote' : 'view'}
            notify={notify}
            onPromoted={() => mutate()}
          />
        )}

        <TopFive title={`🤵 Top 10 — Male (Round ${round})`} list={data.topMale} />
        <TopFive title={`👸 Top 10 — Female (Round ${round})`} list={data.topFemale} />

        <RoundsPreviewPanel totalRounds={totalRounds} />
      </div>
    </div>
  );
}

/* ---------------- Round results: ranked lists, CSV download, promotion ---------------- */

interface RoundResultsResponse {
  male: CandidateWithVotes[];
  female: CandidateWithVotes[];
  state: AppState;
}

function RoundResults({
  mode,
  notify,
  onPromoted,
}: {
  mode: 'promote' | 'view';
  notify: (msg: string) => void;
  onPromoted: () => void;
}) {
  const { data, mutate: mutateResults } = useSWR<RoundResultsResponse>('/api/admin/round1-results', fetcher);
  const [maleCount, setMaleCount] = useState(15);
  const [femaleCount, setFemaleCount] = useState(15);
  const [busy, setBusy] = useState(false);
  const [redoDone, setRedoDone] = useState(false);

  if (!data) return <Spinner />;

  const { state } = data;
  const round = state.voting_round;
  const isFinalRound = round === state.total_rounds;
  // Re-do: round hasn't started yet — API returns the previous round's data so admin can re-choose the cutoff.
  const isRedo = mode === 'promote' && state.voting_state === 'not_started' && round > 1;
  const displayRound = isRedo ? round - 1 : round;
  const nextRound = isRedo ? round : round + 1;

  async function promote() {
    const confirmMsg = isRedo
      ? `Re-select the top ${maleCount} male + ${femaleCount} female finalists for Round ${round} (by Round ${displayRound} votes)? This replaces the current selection.`
      : `Promote the top ${maleCount} male + top ${femaleCount} female to Round ${nextRound}${nextRound === state.total_rounds ? ' (Grand Finale)' : ''}? Ties at the cutoff are included.`;
    if (!window.confirm(confirmMsg)) return;
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
          ? `🏆 ${body.finalists.male.length} male + ${body.finalists.female.length} female ${isRedo ? 'updated for' : 'promoted to'} Round ${body.nextRound}!`
          : (body.error ?? 'Promotion failed')
      );
      if (res.ok) {
        onPromoted();
        mutateResults();
        globalMutate('/api/admin/rounds-preview');
        if (isRedo) setRedoDone(true);
      }
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
                {advancing && (
                  <span className="ml-1.5 text-[10px] font-bold text-brand-600 uppercase">
                    → R{nextRound}
                  </span>
                )}
              </span>
              <span className="shrink-0 text-xs font-bold text-brand-600">{c.vote_count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );

  const roundLabel = isFinalRound
    ? `Round ${round} (Grand Finale) results`
    : isRedo
      ? `Round ${displayRound} results`
      : `Round ${round} results`;

  return (
    <div className={`bg-white rounded-2xl p-5 ${mode === 'promote' ? 'border-2 border-brand-200' : 'border border-slate-200'}`}>
      {redoDone && (
        <div className="mb-4 rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm font-semibold text-green-700 flex items-center gap-2">
          ✅ Round {round} finalists updated — top {maleCount} male + {femaleCount} female are now set. Start Round {round} when ready.
        </div>
      )}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="font-extrabold text-slate-900">
          📋 {roundLabel}
          {isRedo && !redoDone && <span className="ml-2 text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">re-selecting Round {round} finalists</span>}
          {isRedo && redoDone && <span className="ml-2 text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">updated ✓</span>}
          {mode === 'view' && !isFinalRound && !isRedo && <span className="text-slate-400 font-semibold">(reference)</span>}
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
          ? isRedo
            ? `Round ${displayRound} results — adjust the cutoff and click the button to replace the Round ${round} finalist selection.`
            : `Ranked by votes. Choose how many advance to Round ${nextRound}${nextRound === state.total_rounds ? ' (Grand Finale)' : ''} — highlighted rows advance (ties at the cutoff are included).`
          : isFinalRound
            ? 'Final standings for this round.'
            : `Standings — highlighted rows were promoted from Round ${round - 1} to Round ${round}.`}
      </p>

      {mode === 'promote' && (
        <div className="flex items-end gap-3 flex-wrap mb-4">
          <label className="text-sm font-semibold text-slate-600">
            Top male
            <input
              type="number"
              min={1}
              max={200}
              value={maleCount}
              onChange={(e) => setMaleCount(Math.max(1, Math.min(200, Number(e.target.value) || 1)))}
              className="block mt-1 w-24 rounded-xl border border-slate-300 px-3 py-2 font-bold focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </label>
          <label className="text-sm font-semibold text-slate-600">
            Top female
            <input
              type="number"
              min={1}
              max={200}
              value={femaleCount}
              onChange={(e) => setFemaleCount(Math.max(1, Math.min(200, Number(e.target.value) || 1)))}
              className="block mt-1 w-24 rounded-xl border border-slate-300 px-3 py-2 font-bold focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </label>
          <button
            onClick={promote}
            disabled={busy}
            className="flex-1 min-w-[200px] rounded-xl py-3 px-4 font-black text-white bg-gradient-to-r from-brand-600 to-purple-600 hover:opacity-95 disabled:opacity-40"
          >
            {busy
              ? (isRedo ? 'Updating…' : 'Promoting…')
              : isRedo
                ? `🔄 Update — top ${maleCount} male + ${femaleCount} female for Round ${round}`
                : `🚀 Promote top ${maleCount} + ${femaleCount} to Round ${nextRound}${nextRound === state.total_rounds ? ' (Finale)' : ''}`}
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

function RoundsConfigCard({
  current,
  currentRound,
  notify,
  onSaved,
}: {
  current: number;
  currentRound: number;
  notify: (msg: string) => void;
  onSaved: () => void;
}) {
  const [value, setValue] = useState(current);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setValue(current); }, [current]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ totalRounds: value }),
      });
      const body = await res.json();
      notify(res.ok ? `Total rounds set to ${value} ✅` : (body.error ?? 'Save failed'));
      if (res.ok) onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="bg-white rounded-2xl border border-slate-200 p-5">
      <label className="text-xs font-bold uppercase tracking-wide text-slate-400">
        Total rounds <span className="normal-case font-semibold">(1 = single round finale, 2 = qualifier + finale, etc.)</span>
      </label>
      <div className="flex gap-3 mt-2 items-center">
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              type="button"
              disabled={n < currentRound}
              onClick={() => setValue(n)}
              className={`w-10 h-10 rounded-xl font-black text-sm transition disabled:opacity-30 disabled:cursor-not-allowed ${
                value === n
                  ? 'bg-brand-600 text-white shadow-md'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <button
          type="submit"
          disabled={saving || value === current}
          className="ml-auto rounded-xl bg-brand-600 px-5 py-2.5 font-bold text-white hover:bg-brand-700 disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
      <p className="mt-2 text-xs text-slate-400">
        Currently in round {currentRound} — cannot set total below the current round.
        {value > 1 && ` Round ${value} will be the Grand Finale.`}
      </p>
    </form>
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

/* ---------------- Rounds Preview ---------------- */

interface RoundData {
  round: number;
  status: string;
  male: CandidateWithVotes[] | null;
  female: CandidateWithVotes[] | null;
}
interface RoundsPreviewResponse {
  rounds: RoundData[];
  state: AppState;
}

function RoundsPreviewPanel({ totalRounds }: { totalRounds: number }) {
  const { data, mutate } = useSWR<RoundsPreviewResponse>('/api/admin/rounds-preview', fetcher, {
    refreshInterval: 15000,
  });
  useRealtime(['/api/admin/rounds-preview']);
  const [open, setOpen] = useState(false);
  const [activeRound, setActiveRound] = useState(1);

  if (!data) return null;

  const { rounds, state } = data;

  const roundLabel = (r: number) =>
    r === state.total_rounds
      ? 'Grand Finale'
      : r === 1
        ? 'Qualifier'
        : `Semi-Final`;

  const statusBadge = (status: string, r: number) => {
    if (status === 'pending') return <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full uppercase">Not yet selected</span>;
    if (status === 'live') return <span className="text-[10px] font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full uppercase animate-pulse">Live</span>;
    if (status === 'paused') return <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full uppercase">Paused</span>;
    if (status === 'ended') return <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full uppercase">Ended</span>;
    if (status === 'not_started' && r === state.voting_round) return <span className="text-[10px] font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded-full uppercase">Ready</span>;
    return null;
  };

  const activeData = rounds.find((r) => r.round === activeRound);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      {/* Header — click to expand/collapse */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition"
      >
        <span className="font-extrabold text-slate-900 flex items-center gap-2">
          📺 Employee App Preview
          <span className="text-xs font-semibold text-slate-400">(what employees see per round)</span>
        </span>
        <span className="text-slate-400 text-lg">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="border-t border-slate-100">
          {/* Round tabs */}
          <div className="flex gap-1 px-5 pt-4 pb-2 overflow-x-auto">
            {rounds.map((rd) => (
              <button
                key={rd.round}
                onClick={() => setActiveRound(rd.round)}
                className={`flex-none flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition ${
                  activeRound === rd.round
                    ? 'bg-brand-600 text-white shadow'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Round {rd.round}
                <span className={`text-[10px] font-semibold ${activeRound === rd.round ? 'text-brand-200' : 'text-slate-400'}`}>
                  {roundLabel(rd.round)}
                </span>
                {rd.status === 'live' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                )}
              </button>
            ))}
          </div>

          {activeData && (
            <div className="px-5 pb-5">
              {/* Round header bar */}
              <div className="flex items-center gap-2 mb-4">
                <span className="text-sm font-extrabold text-slate-700">
                  Round {activeData.round} — {roundLabel(activeData.round)}
                </span>
                {statusBadge(activeData.status, activeData.round)}
                <button
                  onClick={() => mutate()}
                  className="ml-auto text-xs text-slate-400 hover:text-slate-600 font-semibold"
                >
                  ↻ Refresh
                </button>
              </div>

              {activeData.status === 'pending' ? (
                <div className="text-center py-12 text-slate-400">
                  <div className="text-4xl mb-3">🔒</div>
                  <p className="font-semibold">Finalists not yet selected</p>
                  <p className="text-sm mt-1">Complete Round {activeData.round - 1} and promote candidates first.</p>
                </div>
              ) : (
                <div className="grid grid-cols-[1fr_1px_1fr] gap-x-4">
                  {/* Male column */}
                  <PreviewColumn
                    emoji="🤵"
                    label="Male"
                    candidates={activeData.male ?? []}
                    isQualifier={activeData.round === 1}
                  />
                  <div className="bg-slate-200 self-stretch rounded-full" />
                  {/* Female column */}
                  <PreviewColumn
                    emoji="👸"
                    label="Female"
                    candidates={activeData.female ?? []}
                    isQualifier={activeData.round === 1}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PreviewColumn({
  emoji,
  label,
  candidates,
  isQualifier,
}: {
  emoji: string;
  label: string;
  candidates: CandidateWithVotes[];
  isQualifier: boolean;
}) {
  const maxVotes = Math.max(1, ...candidates.map((c) => c.vote_count));

  if (candidates.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-slate-400">
        No {label.toLowerCase()} candidates.
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <div className="rounded-2xl bg-slate-50 border border-slate-200 px-3 py-2 flex items-center justify-between mb-2">
        <h4 className="font-extrabold text-slate-900 text-sm">{emoji} {label}</h4>
        <span className="text-[10px] font-bold text-slate-400">{candidates.length} candidates</span>
      </div>
      <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
        {candidates.map((c, i) => {
          const share = maxVotes > 0 ? (c.vote_count / maxVotes) * 100 : 0;
          const isTop = !isQualifier && i === 0 && c.vote_count > 0;
          return (
            <div
              key={c.id}
              className={`relative bg-white rounded-2xl px-2.5 py-3 border flex flex-col items-center text-center gap-1 ${
                isTop ? 'border-amber-300' : 'border-slate-200'
              }`}
            >
              {!isQualifier && (
                <span
                  className={`absolute top-2 left-2 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-extrabold ${
                    i === 0 ? 'bg-amber-400 text-white' : i === 1 ? 'bg-slate-200 text-slate-700' : i === 2 ? 'bg-orange-200 text-orange-800' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {i + 1}
                </span>
              )}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={c.image_url}
                alt={c.name}
                className="w-12 h-12 rounded-full object-cover bg-slate-100 border-2 border-white shadow"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(c.name)}`;
                }}
              />
              {isTop && <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-base">👑</span>}
              <p className="font-bold text-slate-900 text-xs leading-tight truncate w-full px-1" title={c.name}>
                {c.name}
              </p>
              {!isQualifier && (
                <>
                  <div className="w-full h-1 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${isTop ? 'bg-amber-400' : 'bg-brand-500'}`}
                      style={{ width: `${share}%` }}
                    />
                  </div>
                  <p className="text-[10px] font-semibold text-slate-500">{c.vote_count} vote{c.vote_count === 1 ? '' : 's'}</p>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- Candidates from Employee Roster ---------------- */

interface EmployeesResponse {
  employees: {
    id: number; employee_code: string; name: string; email: string;
    gender: Gender | null; profile_photo_url: string | null; is_active: number;
  }[];
}
interface CandidatesResponse { candidates: CandidateWithVotes[] }

function CandidatesTab({ notify }: { notify: (msg: string) => void }) {
  useRealtime(['/api/admin/candidates']);
  const { data: empData }  = useSWR<EmployeesResponse>('/api/admin/employees', fetcher);
  const { data: candData, mutate } = useSWR<CandidatesResponse>('/api/admin/candidates', fetcher);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState<number | null>(null); // employee id being toggled

  if (!empData || !candData) return <Spinner />;

  // Index candidates by employee_code and by email for quick lookup
  const candByCode  = new Map(candData.candidates.map(c => [c.employee_code ?? '', c]));
  const candByEmail = new Map(candData.candidates.map(c => [c.email ?? '', c]));

  function findCandidate(emp: EmployeesResponse['employees'][0]) {
    return candByCode.get(emp.employee_code) ?? candByEmail.get(emp.email) ?? null;
  }

  async function toggle(emp: EmployeesResponse['employees'][0]) {
    const existing = findCandidate(emp);
    setBusy(emp.id);
    try {
      if (existing) {
        // Remove from ballot
        const res = await fetch('/api/admin/candidates', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: existing.id }),
        });
        notify(res.ok ? `${emp.name} removed from ballot` : 'Remove failed');
      } else {
        // Add to ballot
        if (!emp.gender) {
          notify(`Set a gender for ${emp.name} in the Employee Roster first.`);
          return;
        }
        const res = await fetch('/api/admin/candidates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: emp.name,
            gender: emp.gender,
            imageUrl: emp.profile_photo_url ?? `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(emp.name)}`,
            email: emp.email,
            employee_code: emp.employee_code,
          }),
        });
        const body = await res.json();
        notify(res.ok ? `${emp.name} added to ballot ✅` : (body.error ?? 'Add failed'));
      }
      mutate();
    } finally {
      setBusy(null);
    }
  }

  async function updateGender(emp: EmployeesResponse['employees'][0], gender: Gender) {
    const existing = findCandidate(emp);
    if (!existing) return;
    setBusy(emp.id);
    try {
      const res = await fetch('/api/admin/candidates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: existing.id, name: existing.name, gender, imageUrl: existing.image_url, email: existing.email }),
      });
      notify(res.ok ? 'Gender updated ✅' : 'Update failed');
      mutate();
    } finally { setBusy(null); }
  }

  const q = search.trim().toLowerCase();
  const filtered = empData.employees.filter(e =>
    !q || e.name.toLowerCase().includes(q) || e.employee_code.includes(q)
  );

  const onBallot   = candData.candidates.length;
  const maleBallot = candData.candidates.filter(c => c.gender === 'male').length;
  const femBallot  = candData.candidates.filter(c => c.gender === 'female').length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="On ballot" value={onBallot} emoji="🗳" />
        <StatCard label="Male" value={maleBallot} emoji="M" />
        <StatCard label="Female" value={femBallot} emoji="F" />
      </div>

      <p className="text-xs text-slate-500 bg-slate-50 rounded-xl px-4 py-3">
        Toggle employees onto the voting ballot. Gender is pulled from the Employee Roster — update it there if needed. Employees without a gender are shown with a warning and cannot be added until gender is set.
      </p>

      {/* Search */}
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="🔍 Search by name or employee code…"
        className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
      />

      {/* Employee list */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-6">No employees found.</p>
        )}
        {filtered.map(emp => {
          const cand    = findCandidate(emp);
          const onBallot = !!cand;
          const isBusy  = busy === emp.id;
          const noGender = !emp.gender;

          return (
            <div key={emp.id}
              className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${
                onBallot ? 'border-brand-300 bg-brand-50/50' : 'border-slate-200 bg-white'
              } ${!emp.is_active ? 'opacity-50' : ''}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={emp.profile_photo_url ?? `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(emp.name)}`}
                alt={emp.name}
                className="w-10 h-10 rounded-full object-cover bg-slate-100 shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-800 text-sm truncate">
                  {cand?.is_finalist ? '⭐ ' : ''}{emp.name}
                  <span className="ml-1.5 text-[10px] font-bold text-slate-400">#{emp.employee_code}</span>
                </p>
                <p className="text-xs text-slate-400">
                  {noGender
                    ? <span className="text-amber-600 font-semibold">⚠️ No gender — set in Roster to add</span>
                    : emp.gender === 'male' ? '🤵 Male' : '👸 Female'}
                  {onBallot && cand && <span className="ml-2 text-brand-600 font-semibold">{cand.vote_count} votes</span>}
                </p>
              </div>
              {/* Gender override while on ballot */}
              {onBallot && cand && (
                <select
                  value={cand.gender ?? ''}
                  onChange={e => updateGender(emp, e.target.value as Gender)}
                  disabled={isBusy}
                  className="text-xs rounded-lg border border-slate-200 px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-brand-400"
                >
                  <option value="male">🤵 Male</option>
                  <option value="female">👸 Female</option>
                </select>
              )}
              <button
                onClick={() => toggle(emp)}
                disabled={isBusy || (!onBallot && noGender)}
                className={`shrink-0 rounded-xl px-4 py-2 text-sm font-bold transition disabled:opacity-40 ${
                  onBallot
                    ? 'bg-red-50 text-red-600 hover:bg-red-100'
                    : 'bg-brand-600 text-white hover:bg-brand-700'
                }`}
              >
                {isBusy ? '…' : onBallot ? 'Remove' : 'Add'}
              </button>
            </div>
          );
        })}
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
