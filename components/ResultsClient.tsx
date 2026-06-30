'use client';

import useSWR from 'swr';
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


export default function ResultsClient({ isAdmin }: { isAdmin: boolean }) {
  const router = useRouter();
  useRealtime(['/api/results']);
  const { data, error } = useSWR<ResultsResponse>('/api/results', fetcher, {
    refreshInterval: 10000,
    shouldRetryOnError: true,
    errorRetryInterval: 3000,
  });

  void isAdmin; // prop kept for API compat; user view always shows simple list

  if (error && (error as { status?: number }).status === 403) {
    const votingState = (error as { body?: { voting_state?: string } }).body?.voting_state;
    // If voting is no longer ended (admin reset / new round started), go back to dashboard
    if (votingState && votingState !== 'ended') {
      router.replace('/');
      return null;
    }
    // Voting ended but results not yet announced
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center px-8">
        <motion.div
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="text-6xl mb-4"
        >
          🔮
        </motion.div>
        <h2 className="text-xl font-extrabold text-slate-900">Results coming soon</h2>
        <p className="text-slate-500 mt-2 text-sm">
          Watch the main screen for the announcement!
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex justify-center py-24">
        <div className="w-10 h-10 rounded-full border-4 border-slate-200 border-t-orange-400 animate-spin" />
      </div>
    );
  }

  const maleWinner   = data.male[0];
  const femaleWinner = data.female[0];

  return (
    <div className="max-w-lg mx-auto px-4 pb-24 pt-4">
      <motion.div key="reveal" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-amber-500 mb-0.5 text-center">
          Octal IT Solution LLP presents
        </p>
        <h1 className="text-2xl font-black text-slate-900 mb-6 text-center">
          {data.state.event_name}
        </h1>

        {/* Winner cards */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          {maleWinner   && <WinnerCard candidate={maleWinner}   label="Most Popular Male"   delay={0}   />}
          {femaleWinner && <WinnerCard candidate={femaleWinner} label="Most Popular Female" delay={0.2} />}
        </div>

        <SimpleRankedList title="🤵 Male leaderboard"   candidates={data.male}   startDelay={0.4} />
        <SimpleRankedList title="👸 Female leaderboard" candidates={data.female} startDelay={0.5} />
      </motion.div>
    </div>
  );
}

function WinnerCard({ candidate, label, delay }: {
  candidate: CandidateWithVotes; label: string; delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: 'spring', stiffness: 140, damping: 18 }}
      className="rounded-3xl overflow-hidden border-2 border-amber-300 bg-white shadow-lg"
    >
      <div className="bg-gradient-to-b from-amber-50 to-white px-3 pt-6 pb-4 flex flex-col items-center text-center">
        <p className="text-[9px] font-bold uppercase tracking-widest text-amber-600 mb-3">{label}</p>
        <div className="relative mb-3">
          <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-2xl">👑</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={candidate.image_url}
            alt={candidate.name}
            className="w-24 h-24 rounded-full object-cover border-4 border-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.4)]"
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(candidate.name)}`;
            }}
          />
        </div>
        <p className="font-black text-slate-900 text-[15px] leading-snug">{candidate.name}</p>
        <p className="text-xs text-amber-600 font-semibold mt-1">
          {candidate.vote_count} vote{candidate.vote_count === 1 ? '' : 's'}
        </p>
      </div>
    </motion.div>
  );
}

function SimpleRankedList({ title, candidates, startDelay = 0 }: {
  title: string; candidates: CandidateWithVotes[]; startDelay?: number;
}) {
  const medal = (i: number) => (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null);
  return (
    <div className="mb-8">
      <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-3">{title}</h2>
      <div className="space-y-2">
        {candidates.map((c, i) => (
          <motion.div
            key={c.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: startDelay + i * 0.06 }}
            className={`flex items-center gap-3 rounded-2xl px-4 py-3 border ${
              i === 0 ? 'bg-amber-50 border-amber-200'
              : i === 1 ? 'bg-slate-50 border-slate-200'
              : i === 2 ? 'bg-orange-50 border-orange-200'
              : 'bg-white border-slate-100'
            }`}
          >
            <span className="w-7 text-center text-lg shrink-0">
              {medal(i) ?? <span className="text-sm font-bold text-slate-400">{i + 1}</span>}
            </span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={c.image_url}
              alt={c.name}
              className="w-10 h-10 rounded-full object-cover bg-slate-100 shrink-0"
              onError={(e) => {
                (e.target as HTMLImageElement).src =
                  `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(c.name)}`;
              }}
            />
            <p className="flex-1 font-semibold text-slate-900 truncate">{c.name}</p>
            <span className="text-sm font-bold text-slate-500 shrink-0">
              {c.vote_count} vote{c.vote_count === 1 ? '' : 's'}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
