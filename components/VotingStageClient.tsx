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

function WinnersDisplay({ male, female }: { male?: CandidateWithVotes; female?: CandidateWithVotes }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 120, damping: 18 }}
      className="flex-1 flex flex-col sm:flex-row items-center justify-center gap-10 sm:gap-20 py-6"
    >
      {male   && <BigWinnerCard candidate={male}   label="Most Popular Male"   emoji="🤵" delay={0}   />}
      {female && <BigWinnerCard candidate={female} label="Most Popular Female" emoji="👸" delay={0.35} />}
    </motion.div>
  );
}

function BigWinnerCard({ candidate, label, emoji, delay }: {
  candidate: CandidateWithVotes; label: string; emoji: string; delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 60 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: 'spring', stiffness: 110, damping: 16 }}
      className="flex flex-col items-center text-center"
    >
      <p className="text-sm sm:text-base font-bold uppercase tracking-widest text-amber-300 mb-6">
        {emoji} {label}
      </p>

      {/* Photo with pulsing gold ring */}
      <motion.div
        animate={{ y: [0, -10, 0] }}
        transition={{ repeat: Infinity, duration: 3.5, ease: 'easeInOut' }}
        className="relative mb-6"
      >
        <span className="absolute -top-7 left-1/2 -translate-x-1/2 text-5xl drop-shadow-lg">👑</span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={candidate.image_url}
          alt={candidate.name}
          className="w-44 h-44 sm:w-56 sm:h-56 rounded-full object-cover border-4 border-amber-400"
          style={{ boxShadow: '0 0 50px rgba(251,191,36,0.55), 0 0 120px rgba(251,191,36,0.20)' }}
          onError={(e) => {
            (e.target as HTMLImageElement).src =
              `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(candidate.name)}`;
          }}
        />
        {/* Pulsing outer ring */}
        <motion.div
          animate={{ scale: [1, 1.08, 1], opacity: [0.6, 0.2, 0.6] }}
          transition={{ repeat: Infinity, duration: 2.5 }}
          className="absolute inset-0 rounded-full border-2 border-amber-400 pointer-events-none"
        />
      </motion.div>

      <h2 className="text-3xl sm:text-5xl font-black gold-text leading-tight mb-2">
        {candidate.name}
      </h2>
      <p className="text-base sm:text-lg font-semibold text-slate-400">
        {candidate.vote_count} vote{candidate.vote_count === 1 ? '' : 's'}
      </p>
    </motion.div>
  );
}

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
  hideVotes = false,
}: {
  candidate: CandidateWithVotes;
  rank: number;
  maxVotes: number;
  color: string;
  hideVotes?: boolean;
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
        !hideVotes && rank === 1 ? 'border-amber-400/70 bg-amber-400/8' : 'border-white/10 bg-white/5'
      }`}
    >
      {/* animated fill bar — hidden in secret mode */}
      {!hideVotes && (
        <motion.div
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', stiffness: 60, damping: 18 }}
          className="absolute inset-y-0 left-0 rounded-2xl"
          style={{ background: rank === 1 ? 'rgba(251,191,36,0.18)' : `${color}22` }}
        />
      )}
      <div className="relative flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {!hideVotes && <span className="text-2xl w-8 text-center shrink-0">{medal}</span>}
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
        {!hideVotes && (
          <span className="shrink-0 text-xl sm:text-2xl font-black text-amber-300">
            {candidate.vote_count}
            <span className="text-sm font-bold text-slate-400 ml-1">
              {candidate.vote_count === 1 ? 'vote' : 'votes'}
            </span>
          </span>
        )}
      </div>
    </motion.div>
  );
}

function GenderColumn({
  title,
  emoji,
  candidates,
  color,
  hideVotes = false,
}: {
  title: string;
  emoji: string;
  candidates: CandidateWithVotes[];
  color: string;
  hideVotes?: boolean;
}) {
  const maxVotes = Math.max(1, ...candidates.map((c) => c.vote_count));
  const displayed = hideVotes
    ? [...candidates].sort((a, b) => a.name.localeCompare(b.name))
    : candidates;

  return (
    <div className="flex-1 min-w-0">
      <h2 className="text-center text-xl sm:text-2xl font-black mb-4 flex items-center justify-center gap-2">
        <span>{emoji}</span>
        <span style={{ color }}>{title}</span>
      </h2>
      {displayed.length === 0 ? (
        <p className="text-center text-slate-500 font-semibold py-12">No votes yet</p>
      ) : (
        <motion.div layout className="space-y-2.5">
          <AnimatePresence>
            {displayed.map((c, i) => (
              <CandidateBar key={c.id} candidate={c} rank={i + 1} maxVotes={maxVotes} color={color} hideVotes={hideVotes} />
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}

interface VoteFlash {
  key: string;
  candidate: CandidateWithVotes;
  delta: number;
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

  // Vote flash toasts — detect count changes between refreshes
  const prevCounts = useRef<Map<number, number>>(new Map());
  const flashSeq = useRef(0);
  const [flashes, setFlashes] = useState<VoteFlash[]>([]);

  useEffect(() => {
    if (!data) return;
    const all = [...data.topMale, ...data.topFemale];
    const newFlashes: VoteFlash[] = [];
    for (const c of all) {
      const prev = prevCounts.current.get(c.id) ?? 0;
      const delta = c.vote_count - prev;
      if (delta !== 0) {
        newFlashes.push({ key: `${c.id}-${++flashSeq.current}`, candidate: c, delta });
      }
      prevCounts.current.set(c.id, c.vote_count);
    }
    if (newFlashes.length === 0) return;
    setFlashes(f => [...f, ...newFlashes]);
    const timer = setTimeout(() => {
      setFlashes(f => f.filter(fl => !newFlashes.find(n => n.key === fl.key)));
    }, 3000);
    return () => clearTimeout(timer);
  }, [data]);
  const stats     = data?.stats;

  const winners = (awardsData?.categories ?? []).filter((c: { winner?: unknown }) => c.winner);
  const winnerCount = winners.length;
  const prevWinnerCount = useRef(0);
  const [winnerBurst, setWinnerBurst] = useState<{ name: string; category: string } | null>(null);

  const COLORS = ['#FE9234', '#FFD700', '#FF6B6B', '#4ECDC4', '#A78BFA', '#FFFFFF'];

  // Drumroll → reveal → winners phase when results are announced
  const [announcePhase, setAnnouncePhase] = useState<'idle' | 'drumroll' | 'reveal' | 'winners'>('idle');
  const prevResultsAnnounced = useRef<boolean | null>(null); // null = data not yet loaded
  useEffect(() => {
    if (!data) return; // wait for first data load
    if (prevResultsAnnounced.current === null) {
      // First load — if already announced, skip straight to winners
      prevResultsAnnounced.current = resultsAnnounced;
      if (resultsAnnounced) setAnnouncePhase('winners');
      return;
    }
    if (resultsAnnounced && !prevResultsAnnounced.current) {
      // Transition: not announced → announced — play full drumroll sequence
      prevResultsAnnounced.current = true;
      setAnnouncePhase('drumroll');
      const t = setTimeout(() => {
        setAnnouncePhase('reveal');
        confetti({ particleCount: 300, spread: 100, origin: { y: 0.5 }, colors: COLORS, zIndex: 200 });
        setTimeout(() => confetti({ particleCount: 200, spread: 80, angle: 60,  origin: { x: 0,   y: 0.6 }, colors: COLORS, zIndex: 200 }), 400);
        setTimeout(() => confetti({ particleCount: 200, spread: 80, angle: 120, origin: { x: 1,   y: 0.6 }, colors: COLORS, zIndex: 200 }), 800);
        setTimeout(() => confetti({ particleCount: 180, spread: 360, startVelocity: 35,
          origin: { x: 0.5, y: 0.4 }, colors: ['#fbbf24','#fde68a','#f59e0b','#fff'], zIndex: 200 }), 1200);
        setTimeout(() => setAnnouncePhase('winners'), 4000);
      }, 2600);
      return () => clearTimeout(t);
    }
    prevResultsAnnounced.current = resultsAnnounced;
  }, [resultsAnnounced, data]); // eslint-disable-line react-hooks/exhaustive-deps

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
      {/* Vote flash — centered, floats up and fades */}
      <div className="fixed inset-0 z-30 pointer-events-none flex items-center justify-center">
        <AnimatePresence>
          {flashes.map(fl => (
            <motion.div
              key={fl.key}
              variants={{
                hidden:  { opacity: 0, y: 20, scale: 0.7 },
                visible: { opacity: 1, y: 0,  scale: 1,   transition: { type: 'spring', stiffness: 400, damping: 22 } },
                gone:    { opacity: 0, y: -200, scale: 0.85, transition: { duration: 1.6, ease: [0.25, 0.1, 0.25, 1] } },
              }}
              initial="hidden"
              animate="visible"
              exit="gone"
              className="absolute flex flex-col items-center gap-3"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={fl.candidate.image_url}
                alt=""
                className="w-24 h-24 rounded-full object-cover ring-4 ring-white/30 shadow-2xl"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(fl.candidate.name)}`;
                }}
              />
              <p className="text-white font-extrabold text-xl drop-shadow-lg">{fl.candidate.name}</p>
              <span className={`text-7xl font-black drop-shadow-2xl leading-none ${fl.delta > 0 ? 'text-green-400' : 'text-red-400'}`}>
                {fl.delta > 0 ? `+${fl.delta}` : fl.delta}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

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
              {stats.totalVotes.toLocaleString()} votes cast &nbsp;·&nbsp; {stats.voters} of {stats.totalUsers} voters
            </p>
          )}
        </div>

        {/* Columns or Winner Cards */}
        {announcePhase === 'winners' ? (
          <WinnersDisplay male={topMale[0]} female={topFemale[0]} />
        ) : (
          <div className="flex-1 flex flex-col sm:flex-row gap-8 sm:gap-10">
            <GenderColumn title="Mr. ABHYUDAY" emoji="👨" candidates={topMale}   color="#60A5FA" hideVotes={!resultsAnnounced} />
            {/* Mobile: horizontal rule; Desktop: vertical rule */}
            <div className="sm:hidden h-px w-full rounded-full" style={{ background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.25), transparent)' }} />
            <div className="hidden sm:block w-px self-stretch rounded-full" style={{ background: 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.3) 20%, rgba(255,255,255,0.3) 80%, transparent)' }} />
            <GenderColumn title="Ms. ABHYUDAY" emoji="👩" candidates={topFemale} color="#F472B6" hideVotes={!resultsAnnounced} />
          </div>
        )}

        <p className="text-center text-xs text-slate-600 mt-6">
          Vote on your phone · sign in at the event app 📱
        </p>
      </div>
    </div>
  );
}
