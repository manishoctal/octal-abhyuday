'use client';

import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import confetti from 'canvas-confetti';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useRealtime } from './useRealtime';
import type { CandidateWithVotes, AppState } from '@/lib/types';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const body = await res.json();
  if (!res.ok) throw Object.assign(new Error(body.error ?? 'Error'), { status: res.status, body });
  return body;
};

interface ResultsResponse {
  male: CandidateWithVotes[];
  female: CandidateWithVotes[];
  state: AppState;
}

function fireConfetti() {
  const defaults = { spread: 80, ticks: 120, gravity: 0.9, scalar: 1.1, zIndex: 60 };
  confetti({ ...defaults, particleCount: 120, origin: { x: 0.2, y: 0.7 }, angle: 60 });
  confetti({ ...defaults, particleCount: 120, origin: { x: 0.8, y: 0.7 }, angle: 120 });
  setTimeout(
    () =>
      confetti({
        ...defaults,
        particleCount: 180,
        origin: { x: 0.5, y: 0.4 },
        spread: 360,
        startVelocity: 35,
        colors: ['#fbbf24', '#fde68a', '#f59e0b', '#ffffff'],
      }),
    400
  );
}

const SPARKLES = [
  { top: '8%', left: '12%', delay: '0s' },
  { top: '15%', left: '85%', delay: '0.4s' },
  { top: '30%', left: '5%', delay: '0.8s' },
  { top: '45%', left: '92%', delay: '0.2s' },
  { top: '60%', left: '10%', delay: '1.1s' },
  { top: '75%', left: '88%', delay: '0.6s' },
  { top: '85%', left: '20%', delay: '1.3s' },
  { top: '12%', left: '50%', delay: '0.9s' },
];

export default function ResultsClient({ isAdmin }: { isAdmin: boolean }) {
  const router = useRouter();
  // SSE pushes the announcement instantly; polling is only a reconnect fallback
  useRealtime(['/api/results']);
  const { data, error } = useSWR<ResultsResponse>('/api/results', fetcher, {
    refreshInterval: 10000,
    shouldRetryOnError: true,
    errorRetryInterval: 3000,
  });
  const [phase, setPhase] = useState<'drumroll' | 'reveal'>('drumroll');

  const announced = data?.state.results_announced ?? false;

  useEffect(() => {
    if (!announced) return;
    const t = setTimeout(() => {
      setPhase('reveal');
      fireConfetti();
    }, 2600);
    return () => clearTimeout(t);
  }, [announced]);

  const winners = useMemo(() => {
    if (!data) return null;
    return { male: data.male[0], female: data.female[0] };
  }, [data]);

  if (error && (error as { status?: number }).status === 403) {
    const votingState = (error as { body?: { voting_state?: string } }).body?.voting_state;
    // If voting is no longer ended (admin reset / new round started), go back to dashboard
    if (votingState && votingState !== 'ended') {
      router.replace('/');
      return null;
    }
    // Voting ended but results not yet announced — wait for announcement
    return (
      <Stage>
        <div className="text-center py-24 relative z-10">
          <motion.div
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="text-6xl mb-4"
          >
            🔮
          </motion.div>
          <h2 className="text-2xl font-extrabold text-white">Results not announced yet</h2>
          <p className="text-slate-400 mt-2">
            The suspense is real… results will appear here the moment they&apos;re announced!
          </p>
        </div>
      </Stage>
    );
  }

  if (!data) {
    return (
      <Stage>
        <div className="flex justify-center py-24 relative z-10">
          <div className="w-10 h-10 rounded-full border-4 border-slate-700 border-t-amber-400 animate-spin" />
        </div>
      </Stage>
    );
  }

  // Admin preview before announcement
  const previewOnly = !announced && isAdmin;

  return (
    <Stage lightning={announced && phase === 'reveal'}>
      <div className="relative z-10 max-w-3xl mx-auto px-4 pb-24">
        {previewOnly && (
          <div className="mt-4 rounded-2xl bg-amber-400/10 border border-amber-400/40 px-4 py-3 text-amber-300 text-sm font-semibold">
            👁️ Admin preview — employees can&apos;t see this until you announce results.
          </div>
        )}

        {announced && phase === 'drumroll' ? (
            <motion.div
              key="drumroll"
              className="text-center py-28"
            >
              <motion.div
                animate={{ scale: [1, 1.3, 1], rotate: [0, 5, -5, 0] }}
                transition={{ repeat: Infinity, duration: 0.7 }}
                className="text-7xl mb-6"
              >
                🥁
              </motion.div>
              <p className="text-sm font-bold uppercase tracking-[0.25em] text-amber-300/80 mb-2">
                {data.state.event_name}
              </p>
              <motion.h2
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ repeat: Infinity, duration: 1 }}
                className="text-3xl font-extrabold text-white tracking-wide"
              >
                And the winners are…
              </motion.h2>
            </motion.div>
          ) : (
            <motion.div
              key="reveal"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="pt-8"
            >
              <div className="text-center mb-8">
                <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-amber-300/80">
                  Octal IT Solutions presents
                </p>
                <h1 className="text-3xl sm:text-4xl font-black gold-text leading-tight">
                  ✨ {data.state.event_name} ✨
                </h1>
                <p className="text-sm font-semibold text-slate-400 mt-1">Most Popular — Winners</p>
              </div>

              <div className="grid sm:grid-cols-2 gap-6 mb-12">
                {winners?.male && <WinnerCard candidate={winners.male} label="Most Popular Male" emoji="🤵" delay={0} />}
                {winners?.female && <WinnerCard candidate={winners.female} label="Most Popular Female" emoji="👸" delay={0.3} />}
              </div>

              <RankedList title="🤵 Male leaderboard" candidates={data.male} />
              <RankedList title="👸 Female leaderboard" candidates={data.female} />
            </motion.div>
          )}
      </div>
    </Stage>
  );
}

function Stage({ children, lightning }: { children: React.ReactNode; lightning?: boolean }) {
  return (
    <div className="min-h-dvh bg-gradient-to-b from-slate-950 via-indigo-950 to-slate-900 relative overflow-hidden">
      {lightning && (
        <>
          <div className="lightning-flash" />
          <div className="lightning-flash delay" />
        </>
      )}
      {SPARKLES.map((s, i) => (
        <span key={i} className="sparkle" style={{ top: s.top, left: s.left, animationDelay: s.delay }} />
      ))}
      {children}
    </div>
  );
}

function WinnerCard({
  candidate,
  label,
  emoji,
  delay,
}: {
  candidate: CandidateWithVotes;
  label: string;
  emoji: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 60, rotateY: 90 }}
      animate={{ opacity: 1, y: 0, rotateY: 0 }}
      transition={{ delay, type: 'spring', stiffness: 120, damping: 16 }}
      className="gold-border rounded-3xl"
    >
      <div className="bg-slate-900 rounded-3xl p-6 text-center relative overflow-hidden">
        <div className="text-sm font-bold uppercase tracking-widest text-amber-300">
          {emoji} {label}
        </div>
        <motion.div
          animate={{ y: [0, -6, 0] }}
          transition={{ repeat: Infinity, duration: 3 }}
          className="relative inline-block mt-4"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={candidate.image_url}
            alt={candidate.name}
            className="w-28 h-28 rounded-full object-cover mx-auto border-4 border-amber-400 shadow-[0_0_30px_rgba(251,191,36,0.5)]"
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(candidate.name)}`;
            }}
          />
          <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-3xl drop-shadow">👑</span>
        </motion.div>
        <h3 className="mt-4 text-2xl font-black gold-text">{candidate.name}</h3>
        <p className="text-slate-400 text-sm font-semibold mt-1">
          {candidate.vote_count} vote{candidate.vote_count === 1 ? '' : 's'}
        </p>
      </div>
    </motion.div>
  );
}

function RankedList({ title, candidates }: { title: string; candidates: CandidateWithVotes[] }) {
  const maxVotes = Math.max(1, ...candidates.map((c) => c.vote_count));
  const medal = (i: number) => (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`);
  return (
    <div className="mb-10">
      <h2 className="text-lg font-extrabold text-white mb-3">{title}</h2>
      <div className="space-y-2">
        {candidates.map((c, i) => (
          <motion.div
            key={c.id}
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 + i * 0.08 }}
            className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${
              i === 0
                ? 'bg-amber-400/10 border border-amber-400/40'
                : i === 1
                  ? 'bg-slate-300/10 border border-slate-400/30'
                  : i === 2
                    ? 'bg-orange-400/10 border border-orange-400/30'
                    : 'bg-white/5 border border-white/10'
            }`}
          >
            <span className="w-8 text-center text-lg font-bold text-slate-300">{medal(i)}</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={c.image_url}
              alt={c.name}
              className="w-10 h-10 rounded-full object-cover bg-slate-800"
              onError={(e) => {
                (e.target as HTMLImageElement).src =
                  `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(c.name)}`;
              }}
            />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-white truncate">{c.name}</p>
              <div className="mt-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(c.vote_count / maxVotes) * 100}%` }}
                  transition={{ delay: 0.8 + i * 0.08, duration: 0.6 }}
                  className={`h-full rounded-full ${i === 0 ? 'bg-amber-400' : 'bg-brand-400'}`}
                />
              </div>
            </div>
            <span className="text-sm font-bold text-slate-300">{c.vote_count}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
