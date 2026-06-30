'use client';

import { useEffect, useRef } from 'react';
import useSWR from 'swr';
import confetti from 'canvas-confetti';
import { motion } from 'framer-motion';
import { useRealtime } from './useRealtime';
import type {
  QaLeaderboardRow,
  QaQuestionState,
  QaQuestionType,
  QaResults,
  QaSessionKind,
  CandidateWithVotes,
  AppState,
} from '@/lib/types';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const kindEmoji: Record<QaSessionKind, string> = { qna: '💬', poll: '📊', ranking: '🏅' };

interface ResultsResponse {
  male: CandidateWithVotes[];
  female: CandidateWithVotes[];
  state: AppState;
}

interface OverviewResponse {
  eventName: string;
  session: { id: number; title: string; status: string; kind: QaSessionKind } | null;
  question: {
    id: number;
    type: QaQuestionType;
    prompt: string;
    options: string[];
    state: QaQuestionState;
    correct_option: number | null;
  } | null;
  answerCount: number;
  results: QaResults | null;
  leaderboard: QaLeaderboardRow[];
}

const SPARKLES = [
  { top: '6%', left: '8%', delay: '0s' },
  { top: '12%', left: '90%', delay: '0.5s' },
  { top: '40%', left: '4%', delay: '1s' },
  { top: '70%', left: '94%', delay: '0.3s' },
  { top: '85%', left: '12%', delay: '0.8s' },
  { top: '20%', left: '55%', delay: '1.2s' },
];

export default function StageClient() {
  useRealtime(['/api/admin/qa/overview', '/api/results']);
  const { data } = useSWR<OverviewResponse>('/api/admin/qa/overview', fetcher, {
    refreshInterval: 15000,
  });
  const { data: resultsData } = useSWR<ResultsResponse>('/api/results', fetcher, {
    refreshInterval: 15000,
  });
  const resultsAnnounced = resultsData?.state?.results_announced ?? false;

  // Confetti burst on reveal
  const lastReveal = useRef<string>('');
  useEffect(() => {
    const q = data?.question;
    if (q && q.state === 'revealed' && lastReveal.current !== `${q.id}`) {
      lastReveal.current = `${q.id}`;
      confetti({ particleCount: 160, spread: 100, origin: { y: 0.6 }, zIndex: 60 });
    }
  }, [data]);

  return (
    <div className="min-h-dvh bg-gradient-to-b from-slate-950 via-indigo-950 to-slate-900 relative overflow-hidden text-white">
      {SPARKLES.map((s, i) => (
        <span key={i} className="sparkle" style={{ top: s.top, left: s.left, animationDelay: s.delay }} />
      ))}

      <div className="relative z-10 max-w-6xl mx-auto px-6 sm:px-10 py-8 min-h-dvh flex flex-col">
        {/* Branding header */}
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-amber-300/70">
            Octal IT Solution LLP presents
          </p>
          <h1 className="text-3xl sm:text-5xl font-black gold-text leading-tight">
            {data?.eventName ?? '…'}
          </h1>
          {data?.session && (
            <p className="text-base sm:text-lg font-bold text-slate-300 mt-1">
              {kindEmoji[data.session.kind]} {data.session.title}
              {data.session.status === 'live' && (
                <span className="ml-3 align-middle text-xs font-bold uppercase bg-green-500/20 text-green-300 px-2.5 py-1 rounded-full animate-pulse">
                  ● Live
                </span>
              )}
            </p>
          )}
        </div>

        <div className="flex-1 flex flex-col justify-center py-8">
          {!data ? (
            <div className="flex justify-center">
              <div className="w-12 h-12 rounded-full border-4 border-slate-700 border-t-amber-400 animate-spin" />
            </div>
          ) : !data.session ? (
            resultsAnnounced && resultsData
              ? <VotingWinners resultsData={resultsData} />
              : <Idle emoji="🎤" text="Waiting for the show to begin…" />
          ) : data.session.status === 'ended' ? (
            <div className="space-y-12">
              {data.question && <StageQuestion data={data} />}
              {data.leaderboard.length > 0 && <StageLeaderboard rows={data.leaderboard} />}
              {!data.question && data.leaderboard.length === 0 && (
                resultsAnnounced && resultsData
                  ? <VotingWinners resultsData={resultsData} />
                  : <Idle emoji="👏" text="That's a wrap — thanks for playing!" />
              )}
            </div>
          ) : !data.question ? (
            <Idle emoji="🥁" text="Get your phones ready…" />
          ) : (
            <StageQuestion data={data} />
          )}
        </div>

        {/* Voting winners strip — shown alongside an active Q&A session when results are announced */}
        {resultsAnnounced && resultsData && data?.session && data.session.status !== 'ended' && (
          <div className="pb-8">
            <VotingWinners resultsData={resultsData} compact />
          </div>
        )}

        <p className="text-center text-xs text-slate-500">
          Answer on your phone — sign in at the voting site 📱
        </p>
      </div>
    </div>
  );
}

function Idle({ emoji, text }: { emoji: string; text: string }) {
  return (
    <div className="text-center">
      <motion.div
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ repeat: Infinity, duration: 1.6 }}
        className="text-8xl mb-6"
      >
        {emoji}
      </motion.div>
      <p className="text-2xl sm:text-3xl font-extrabold text-slate-300">{text}</p>
    </div>
  );
}

function StageQuestion({ data }: { data: OverviewResponse }) {
  const q = data.question!;
  const revealed = q.state === 'revealed';

  return (
    <motion.div key={q.id + q.state} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}>
      <div className="text-center mb-8">
        <h2 className="text-3xl sm:text-5xl font-black leading-tight">{q.prompt}</h2>
        <p className="mt-3 text-lg font-bold text-amber-300">
          {data.answerCount} answered {!revealed && <span className="animate-pulse">· answers open 📲</span>}
        </p>
      </div>

      {q.type === 'mcq' && <StageMcq q={q} results={data.results} revealed={revealed} />}
      {q.type === 'rating' && <StageRating results={data.results} revealed={revealed} />}
      {q.type === 'text' && <StageText results={data.results} revealed={revealed} />}
      {q.type === 'rank' && <StageRank options={q.options} results={data.results} />}
    </motion.div>
  );
}

function StageMcq({
  q,
  results,
  revealed,
}: {
  q: { options: string[]; correct_option: number | null };
  results: QaResults | null;
  revealed: boolean;
}) {
  const counts = results?.counts ?? q.options.map(() => 0);
  const total = counts.reduce((a, b) => a + b, 0);

  return (
    <div className="max-w-3xl mx-auto space-y-3">
      {q.options.map((opt, i) => {
        const pct = total > 0 ? Math.round((counts[i] / total) * 100) : 0;
        const isCorrect = revealed && q.correct_option === i;
        return (
          <div
            key={i}
            className={`relative rounded-2xl border-2 px-5 py-4 overflow-hidden ${
              isCorrect ? 'border-green-400 bg-green-500/10' : 'border-white/15 bg-white/5'
            }`}
          >
            <motion.div
              animate={{ width: `${pct}%` }}
              transition={{ type: 'spring', stiffness: 90, damping: 20 }}
              className={`absolute inset-y-0 left-0 ${isCorrect ? 'bg-green-400/30' : 'bg-brand-500/30'}`}
            />
            <div className="relative flex items-center justify-between gap-3 text-lg sm:text-2xl font-bold">
              <span>
                {isCorrect && '✅ '}
                {opt}
              </span>
              <span className="shrink-0 font-black">
                {pct}% <span className="text-sm font-bold text-slate-400">({counts[i]})</span>
              </span>
            </div>
          </div>
        );
      })}
      {revealed && q.correct_option !== null && (
        <motion.p
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center text-2xl font-black text-green-400 pt-2"
        >
          ✨ Correct answer: {q.options[q.correct_option]} ✨
        </motion.p>
      )}
    </div>
  );
}

function StageRating({ results, revealed }: { results: QaResults | null; revealed: boolean }) {
  const counts = results?.counts ?? [0, 0, 0, 0, 0];
  const max = Math.max(1, ...counts);
  return (
    <div className="text-center">
      <p className="text-7xl font-black gold-text">
        {results?.average ?? '…'}
        <span className="text-2xl font-bold text-slate-400"> / 5</span>
      </p>
      <div className="flex items-end justify-center gap-4 h-48 mt-8">
        {counts.map((c, i) => (
          <div key={i} className="flex flex-col items-center gap-2 w-16 sm:w-20">
            <span className="text-sm font-bold text-slate-300">{c}</span>
            <motion.div
              animate={{ height: `${(c / max) * 160}px` }}
              transition={{ type: 'spring', stiffness: 90, damping: 18 }}
              className={`w-full rounded-t-xl min-h-[4px] ${revealed ? 'bg-amber-400' : 'bg-brand-400'}`}
            />
            <span className="text-lg font-bold">{i + 1}⭐</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StageText({ results, revealed }: { results: QaResults | null; revealed: boolean }) {
  const answers = (results?.answers ?? []).slice(0, revealed ? 5 : 8);
  const medal = (i: number) => (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null);

  if (answers.length === 0) {
    return <p className="text-center text-xl font-bold text-slate-400">Answers will appear here… 👀</p>;
  }

  return (
    <motion.div layout className="max-w-3xl mx-auto space-y-3">
      {answers.map((a, i) => (
        <motion.div
          layout
          layoutId={`stage-answer-${a.id}`}
          key={a.id}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          className={`flex items-start gap-4 rounded-2xl border px-5 py-4 ${
            revealed && i === 0 && a.upvotes > 0
              ? 'border-amber-400 bg-amber-400/10 animate-glow'
              : 'border-white/15 bg-white/5'
          }`}
        >
          {revealed && medal(i) && a.upvotes > 0 && <span className="text-3xl">{medal(i)}</span>}
          <div className="flex-1 min-w-0">
            <p className={`font-bold break-words ${revealed && i === 0 ? 'text-2xl' : 'text-lg sm:text-xl'}`}>
              {a.value}
            </p>
            <p className="text-sm font-semibold text-slate-400 mt-1">{a.name ?? '🥸 Anonymous'}</p>
          </div>
          <span className="shrink-0 text-lg font-black text-amber-300">😂 {a.upvotes}</span>
        </motion.div>
      ))}
    </motion.div>
  );
}

function StageRank({ options, results }: { options: string[]; results: QaResults | null }) {
  const points = results?.counts ?? options.map(() => 0);
  const maxPts = Math.max(1, ...points);
  const ranked = options.map((opt, i) => ({ opt, i, pts: points[i] })).sort((a, b) => b.pts - a.pts);
  const medal = (pos: number) => (pos === 0 ? '🥇' : pos === 1 ? '🥈' : pos === 2 ? '🥉' : `${pos + 1}`);

  return (
    <motion.div layout className="max-w-3xl mx-auto space-y-3">
      {ranked.map((r, pos) => (
        <motion.div
          layout
          layoutId={`stage-rank-${r.i}`}
          key={r.i}
          transition={{ type: 'spring', stiffness: 280, damping: 26 }}
          className={`relative rounded-2xl border-2 px-5 py-4 overflow-hidden ${
            pos === 0 ? 'border-amber-400 bg-amber-400/10' : 'border-white/15 bg-white/5'
          }`}
        >
          <motion.div
            animate={{ width: `${(r.pts / maxPts) * 100}%` }}
            transition={{ type: 'spring', stiffness: 90, damping: 20 }}
            className={`absolute inset-y-0 left-0 ${pos === 0 ? 'bg-amber-400/25' : 'bg-brand-500/25'}`}
          />
          <div className="relative flex items-center justify-between gap-3 text-lg sm:text-2xl font-bold">
            <span>
              <span className="mr-2">{medal(pos)}</span>
              {r.opt}
            </span>
            <span className="shrink-0 font-black text-amber-300">{r.pts} pts</span>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}

/* ── Voting Winners ─────────────────────────────────────────── */
function VotingWinners({ resultsData, compact = false }: { resultsData: ResultsResponse; compact?: boolean }) {
  const male   = resultsData.male[0];
  const female = resultsData.female[0];
  if (!male && !female) return null;

  if (compact) {
    return (
      <div className="border-t border-white/10 pt-6">
        <p className="text-center text-xs font-bold uppercase tracking-[0.25em] text-amber-300/70 mb-4">
          🏆 Most Popular — Winners
        </p>
        <div className="flex justify-center gap-8">
          {male   && <CompactWinner candidate={male}   label="Most Popular Male"   emoji="🤵" />}
          {female && <CompactWinner candidate={female} label="Most Popular Female" emoji="👸" />}
        </div>
      </div>
    );
  }

  return (
    <motion.div key="voting-winners" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full">
      <div className="text-center mb-10">
        <p className="text-sm font-bold uppercase tracking-[0.25em] text-amber-300/80">
          Octal IT Solution LLP presents
        </p>
        <h2 className="text-4xl sm:text-5xl font-black gold-text leading-tight mt-1">
          {resultsData.state.event_name}
        </h2>
        <p className="text-base font-semibold text-slate-400 mt-1">Most Popular — Winners</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-6 max-w-3xl mx-auto mb-12">
        {male   && <VotingWinnerCard candidate={male}   label="Most Popular Male"   emoji="🤵" delay={0}   />}
        {female && <VotingWinnerCard candidate={female} label="Most Popular Female" emoji="👸" delay={0.3} />}
      </div>

      <VotingRankedList title="🤵 Male leaderboard"   candidates={resultsData.male}   />
      <VotingRankedList title="👸 Female leaderboard" candidates={resultsData.female} />
    </motion.div>
  );
}

function VotingWinnerCard({ candidate, label, emoji, delay }: {
  candidate: CandidateWithVotes; label: string; emoji: string; delay: number;
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

function CompactWinner({ candidate, label, emoji }: {
  candidate: CandidateWithVotes; label: string; emoji: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={candidate.image_url}
          alt={candidate.name}
          className="w-16 h-16 rounded-full object-cover border-2 border-amber-400 shadow-[0_0_14px_rgba(251,191,36,0.4)]"
          onError={(e) => {
            (e.target as HTMLImageElement).src =
              `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(candidate.name)}`;
          }}
        />
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-xl">👑</span>
      </div>
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-amber-300">{emoji} {label}</p>
        <p className="font-black text-white text-sm">{candidate.name}</p>
      </div>
    </div>
  );
}

function VotingRankedList({ title, candidates }: { title: string; candidates: CandidateWithVotes[] }) {
  const maxVotes = Math.max(1, ...candidates.map(c => c.vote_count));
  const medal = (i: number) => (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`);
  return (
    <div className="mb-10 max-w-3xl mx-auto">
      <h2 className="text-lg font-extrabold text-white mb-3">{title}</h2>
      <div className="space-y-2">
        {candidates.map((c, i) => (
          <motion.div
            key={c.id}
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 + i * 0.08 }}
            className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${
              i === 0 ? 'bg-amber-400/10 border border-amber-400/40'
              : i === 1 ? 'bg-slate-300/10 border border-slate-400/30'
              : i === 2 ? 'bg-orange-400/10 border border-orange-400/30'
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
                  className={`h-full rounded-full ${i === 0 ? 'bg-amber-400' : 'bg-slate-400'}`}
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

function StageLeaderboard({ rows }: { rows: QaLeaderboardRow[] }) {
  const medal = (i: number) => (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`);
  if (rows.length === 0) {
    return <Idle emoji="👏" text="That's a wrap — thanks for playing!" />;
  }
  return (
    <div className="max-w-2xl mx-auto w-full">
      <h2 className="text-center text-3xl sm:text-4xl font-black gold-text mb-8">🏆 Final Standings</h2>
      <div className="space-y-3">
        {rows.map((r, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.15 }}
            className={`flex items-center gap-4 rounded-2xl px-6 py-4 ${
              i === 0 ? 'bg-amber-400/15 border border-amber-400/50 animate-glow' : 'bg-white/5 border border-white/10'
            }`}
          >
            <span className="text-3xl w-10 text-center">{medal(i)}</span>
            <span className={`flex-1 font-extrabold truncate ${i === 0 ? 'text-2xl gold-text' : 'text-xl'}`}>
              {r.name}
            </span>
            <span className="text-2xl font-black text-amber-300">{r.score}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
