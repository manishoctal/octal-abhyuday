'use client';

import useSWR from 'swr';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { useEffect, useRef, useState } from 'react';
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
          {candidate.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={candidate.image_url}
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
  useRealtime(['/api/admin/stats', '/api/awards']);
  const { data } = useSWR<StatsResponse>('/api/admin/stats', fetcher, {
    refreshInterval: 10000,
  });
  const { data: awardsData } = useSWR('/api/awards', fetcher, { refreshInterval: 8000 });

  const votingState      = data?.state.voting_state      ?? 'not_started';
  const resultsAnnounced = data?.state.results_announced ?? false;
  const round            = data?.state.voting_round      ?? 1;
  const totalRounds      = data?.state.total_rounds      ?? 2;
  const isFinalRound     = round === totalRounds;
  const topMale   = data?.topMale   ?? [];
  const topFemale = data?.topFemale ?? [];
  const stats     = data?.stats;

  const winners = (awardsData?.categories ?? []).filter((c: { winner?: unknown }) => c.winner);
  const winnerCount = winners.length;
  const prevWinnerCount = useRef(0);
  const [winnerBurst, setWinnerBurst] = useState<{ name: string; category: string } | null>(null);

  const COLORS = ['#FE9234', '#FFD700', '#FF6B6B', '#4ECDC4', '#A78BFA', '#FFFFFF'];

  // Drumroll → reveal phase when results are announced
  const [announcePhase, setAnnouncePhase] = useState<'idle' | 'drumroll' | 'reveal'>('idle');
  const prevResultsAnnounced = useRef(false);
  useEffect(() => {
    if (resultsAnnounced && !prevResultsAnnounced.current) {
      setAnnouncePhase('drumroll');
      const t = setTimeout(() => {
        setAnnouncePhase('reveal');
        // Big confetti burst on reveal
        confetti({ particleCount: 300, spread: 100, origin: { y: 0.5 }, colors: COLORS, zIndex: 200 });
        setTimeout(() => confetti({ particleCount: 200, spread: 80, angle: 60,  origin: { x: 0,   y: 0.6 }, colors: COLORS, zIndex: 200 }), 400);
        setTimeout(() => confetti({ particleCount: 200, spread: 80, angle: 120, origin: { x: 1,   y: 0.6 }, colors: COLORS, zIndex: 200 }), 800);
        setTimeout(() => confetti({ particleCount: 180, spread: 360, startVelocity: 35,
          origin: { x: 0.5, y: 0.4 }, colors: ['#fbbf24','#fde68a','#f59e0b','#fff'], zIndex: 200 }), 1200);
        // Fade out reveal overlay after 4s — stage goes back to leaderboard view with sparkles
        setTimeout(() => setAnnouncePhase('idle'), 4000);
      }, 2600);
      return () => clearTimeout(t);
    }
    prevResultsAnnounced.current = resultsAnnounced;
  }, [resultsAnnounced]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (winnerCount > prevWinnerCount.current && winnerCount > 0) {
      const latest = winners[winners.length - 1] as { name: string; winner: { name: string } };
      setWinnerBurst({ name: latest.winner.name, category: latest.name });
      confetti({ particleCount: 200, spread: 80, origin: { y: 0.6 }, colors: COLORS, zIndex: 200 });
      setTimeout(() => confetti({ particleCount: 120, spread: 60, angle: 60,  origin: { x: 0, y: 0.7 }, colors: COLORS, zIndex: 200 }), 300);
      setTimeout(() => confetti({ particleCount: 120, spread: 60, angle: 120, origin: { x: 1, y: 0.7 }, colors: COLORS, zIndex: 200 }), 500);
      setTimeout(() => setWinnerBurst(null), 5000);
    }
    prevWinnerCount.current = winnerCount;
  }, [winnerCount, winners]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-dvh bg-gradient-to-b from-slate-950 via-indigo-950 to-slate-900 relative overflow-hidden text-white">

      {/* Lightning flash on reveal */}
      {announcePhase === 'reveal' && (
        <>
          <div className="lightning-flash" />
          <div className="lightning-flash delay" />
        </>
      )}

      {/* Drumroll overlay */}
      <AnimatePresence>
        {announcePhase === 'drumroll' && (
          <motion.div
            key="drumroll"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-sm"
          >
            <div className="text-center px-10">
              <motion.div
                animate={{ scale: [1, 1.3, 1], rotate: [0, 5, -5, 0] }}
                transition={{ repeat: Infinity, duration: 0.7 }}
                className="text-[9rem] mb-6 leading-none"
              >
                🥁
              </motion.div>
              <p className="text-sm font-bold uppercase tracking-[0.3em] text-amber-300/80 mb-4">
                {eventName}
              </p>
              <motion.h2
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ repeat: Infinity, duration: 1 }}
                className="text-5xl sm:text-7xl font-black text-white tracking-wide"
              >
                And the winners are…
              </motion.h2>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reveal flash overlay */}
      <AnimatePresence>
        {announcePhase === 'reveal' && (
          <motion.div
            key="reveal-flash"
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
            className="fixed inset-0 z-40 pointer-events-none bg-white"
          />
        )}
      </AnimatePresence>

      {/* Voting ended overlay */}
      <AnimatePresence>
        {votingState === 'ended' && !resultsAnnounced && !winnerBurst && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm"
          >
            <div className="text-center px-10">
              <motion.div
                animate={{ scale: [1, 1.08, 1] }}
                transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
                className="text-7xl mb-6"
              >
                {isFinalRound ? '🏆' : '⏳'}
              </motion.div>
              <h2 className="text-4xl sm:text-6xl font-black text-white leading-tight">
                {isFinalRound ? 'Results Announcing Soon' : 'Next Round Coming Soon'}
              </h2>
              <p className="mt-4 text-lg sm:text-xl text-slate-400 font-semibold">
                {isFinalRound
                  ? 'The votes are in — winners will be revealed any moment! 🎉'
                  : `Round ${round} is over. Stay tuned for Round ${round + 1}!`}
              </p>
              <div className="mt-8 flex items-center justify-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Winner announcement overlay */}
      <AnimatePresence>
        {winnerBurst && (
          <motion.div
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none"
          >
            <div className="text-center px-8">
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ repeat: 3, duration: 0.5 }}
                className="text-6xl mb-4"
              >
                🏆
              </motion.div>
              <p className="text-amber-300 font-bold text-lg uppercase tracking-widest mb-2">{winnerBurst.category}</p>
              <h2 className="text-5xl sm:text-7xl font-black gold-text leading-tight">{winnerBurst.name}</h2>
              <p className="text-2xl text-white/70 mt-3 font-bold">🎉 Congratulations! 🎉</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {SPARKLES.map((s, i) => (
        <span key={i} className="sparkle" style={{ top: s.top, left: s.left, animationDelay: s.delay }} />
      ))}

      <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-10 py-8 flex flex-col min-h-dvh">
        {/* Header */}
        <div className="text-center mb-8">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-amber-300/70">
            Octal IT Solution LLP presents
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
