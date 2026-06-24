'use client';

import useSWR from 'swr';
import { motion, AnimatePresence } from 'framer-motion';
import { useRealtime } from './useRealtime';
import type { CandidateWithVotes, AppState } from '@/lib/types';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface StatsResponse {
  stats: { totalVotes: number; totalUsers: number; voters: number };
  topMale: CandidateWithVotes[];
  topFemale: CandidateWithVotes[];
  state: AppState;
}

const SPARKLES = [
  { top: '6%',  left: '8%',  delay: '0s' },
  { top: '12%', left: '90%', delay: '0.5s' },
  { top: '40%', left: '4%',  delay: '1s' },
  { top: '70%', left: '94%', delay: '0.3s' },
  { top: '85%', left: '12%', delay: '0.8s' },
  { top: '20%', left: '55%', delay: '1.2s' },
];

function VotingStateLabel({ state }: { state: string }) {
  if (state === 'live')
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase bg-green-500/20 text-green-300 px-3 py-1 rounded-full animate-pulse">
        <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
        Voting Open
      </span>
    );
  if (state === 'paused')
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase bg-amber-500/20 text-amber-300 px-3 py-1 rounded-full">
        <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
        Paused
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase bg-slate-500/20 text-slate-400 px-3 py-1 rounded-full">
      Not Started
    </span>
  );
}

function CandidateBar({
  candidate,
  rank,
  maxVotes,
  color,
}: {
  candidate: CandidateWithVotes;
  rank: number;
  maxVotes: number;
  color: string;
}) {
  const pct = maxVotes > 0 ? (candidate.vote_count / maxVotes) * 100 : 0;
  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : String(rank);

  return (
    <motion.div
      layout
      layoutId={`vcandidate-${candidate.id}`}
      initial={{ opacity: 0, x: -30 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 24, delay: rank * 0.06 }}
      className={`relative rounded-2xl border-2 px-5 py-3.5 overflow-hidden ${
        rank === 1 ? 'border-amber-400/70 bg-amber-400/8' : 'border-white/10 bg-white/5'
      }`}
    >
      {/* animated fill bar */}
      <motion.div
        animate={{ width: `${pct}%` }}
        transition={{ type: 'spring', stiffness: 60, damping: 18 }}
        className="absolute inset-y-0 left-0 rounded-2xl"
        style={{ background: rank === 1 ? 'rgba(251,191,36,0.18)' : `${color}22` }}
      />
      <div className="relative flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-2xl w-8 text-center shrink-0">{medal}</span>
          {candidate.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={candidate.photo_url}
              alt=""
              className="w-10 h-10 rounded-full object-cover shrink-0 ring-2 ring-white/20"
            />
          ) : (
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold text-white shrink-0 ring-2 ring-white/20"
              style={{ background: color }}
            >
              {candidate.name.charAt(0)}
            </div>
          )}
          <div className="min-w-0">
            <p className="font-extrabold text-white text-base sm:text-lg leading-tight truncate">
              {candidate.name}
            </p>
            {candidate.department && (
              <p className="text-xs text-slate-400 font-medium truncate">{candidate.department}</p>
            )}
          </div>
        </div>
        <span className="shrink-0 text-xl sm:text-2xl font-black text-amber-300">
          {candidate.vote_count}
          <span className="text-sm font-bold text-slate-400 ml-1">
            {candidate.vote_count === 1 ? 'vote' : 'votes'}
          </span>
        </span>
      </div>
    </motion.div>
  );
}

function GenderColumn({
  title,
  emoji,
  candidates,
  color,
}: {
  title: string;
  emoji: string;
  candidates: CandidateWithVotes[];
  color: string;
}) {
  const maxVotes = Math.max(1, ...candidates.map((c) => c.vote_count));

  return (
    <div className="flex-1 min-w-0">
      <h2 className="text-center text-xl sm:text-2xl font-black mb-4 flex items-center justify-center gap-2">
        <span>{emoji}</span>
        <span style={{ color }}>{title}</span>
      </h2>
      {candidates.length === 0 ? (
        <p className="text-center text-slate-500 font-semibold py-12">No votes yet</p>
      ) : (
        <motion.div layout className="space-y-2.5">
          <AnimatePresence>
            {candidates.map((c, i) => (
              <CandidateBar key={c.id} candidate={c} rank={i + 1} maxVotes={maxVotes} color={color} />
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}

export default function VotingStageClient({ eventName }: { eventName: string }) {
  useRealtime(['/api/admin/stats']);
  const { data } = useSWR<StatsResponse>('/api/admin/stats', fetcher, {
    refreshInterval: 10000,
  });

  const votingState = data?.state.voting_state ?? 'not_started';
  const topMale   = data?.topMale   ?? [];
  const topFemale = data?.topFemale ?? [];
  const stats     = data?.stats;

  return (
    <div className="min-h-dvh bg-gradient-to-b from-slate-950 via-indigo-950 to-slate-900 relative overflow-hidden text-white">
      {SPARKLES.map((s, i) => (
        <span key={i} className="sparkle" style={{ top: s.top, left: s.left, animationDelay: s.delay }} />
      ))}

      <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-10 py-8 flex flex-col min-h-dvh">
        {/* Header */}
        <div className="text-center mb-8">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-amber-300/70">
            Octal IT Solutions presents
          </p>
          <h1 className="text-3xl sm:text-5xl font-black gold-text leading-tight">
            {eventName}
          </h1>
          <div className="flex items-center justify-center gap-4 mt-3">
            <span className="text-lg font-bold text-slate-300">🗳️ Popularity Voting</span>
            <VotingStateLabel state={votingState} />
          </div>
          {stats && (
            <p className="mt-2 text-sm text-slate-500 font-semibold">
              {stats.totalVotes.toLocaleString()} votes cast &nbsp;·&nbsp; {stats.voters} of {stats.totalUsers} participants
            </p>
          )}
        </div>

        {/* Columns */}
        <div className="flex-1 flex flex-col sm:flex-row gap-8 sm:gap-10">
          <GenderColumn title="Mr. ABHYUDAY" emoji="👨" candidates={topMale}   color="#60A5FA" />
          <div className="hidden sm:block w-px bg-white/10 self-stretch" />
          <GenderColumn title="Ms. ABHYUDAY" emoji="👩" candidates={topFemale} color="#F472B6" />
        </div>

        <p className="text-center text-xs text-slate-600 mt-6">
          Vote on your phone · sign in at the event app 📱
        </p>
      </div>
    </div>
  );
}
