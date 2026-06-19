'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import CandidateCard from './CandidateCard';
import { useRealtime } from './useRealtime';
import type { CandidateWithVotes, Gender, AppState } from '@/lib/types';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface CandidatesResponse {
  candidates: CandidateWithVotes[];
  myVotes: Record<Gender, number[]>;
  state: AppState;
  qaLive: boolean;
}

export default function VotingClient({ greeting }: { greeting?: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState<CandidateWithVotes | null>(null);
  const [toast, setToast] = useState('');
  const [voting, setVoting] = useState(false);

  // Instant push updates via SSE; slow polling only as a reconnect safety net
  useRealtime(['/api/candidates']);
  const { data, mutate } = useSWR<CandidatesResponse>('/api/candidates', fetcher, {
    refreshInterval: 15000,
  });

  if (!data) {
    return (
      <div className="flex justify-center py-24">
        <div className="w-10 h-10 rounded-full border-4 border-brand-200 border-t-brand-600 animate-spin" />
      </div>
    );
  }

  const { state, myVotes } = data;
  const round = state.voting_round;

  // Finale ended + announced → results experience
  if (round === 2 && state.voting_state === 'ended' && state.results_announced) {
    router.replace('/voting-results');
    return null;
  }

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  const qaBanner = data.qaLive && (
    <Link
      href="/qna"
      className="block mb-4 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-3 text-white font-bold text-sm shadow-lg shadow-pink-200 hover:opacity-95 transition"
    >
      🎤 Live Q&amp;A is happening now — tap to join in!
    </Link>
  );

  const eventHero = (
    <div className="text-center mt-1 mb-4">
      <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.25em] text-brand-500">
        Octal IT Solutions presents
      </p>
      <h1 className="text-3xl sm:text-4xl font-black gold-text leading-tight">
        {state.event_name}
      </h1>
      <span
        className={`inline-block mt-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide ${
          round === 1 ? 'bg-brand-50 text-brand-700' : 'bg-amber-100 text-amber-700'
        }`}
      >
        {round === 1 ? '🔎 Qualifier — vote 1 male & 1 female · top 10 advance' : '🏆 Grand Finale'}
      </span>
      {greeting && <p className="text-sm text-slate-500 mt-1.5">{greeting}</p>}
    </div>
  );

  if (state.voting_state === 'not_started') {
    return (
      <>
        {eventHero}
        {qaBanner}
        <StateHero
          emoji="⏳"
          title={round === 1 ? "Qualifier voting hasn't started yet" : 'The Grand Finale is coming!'}
          subtitle={
            round === 1
              ? 'Hang tight! This page will come alive the moment the admin opens voting.'
              : 'The finalists are locked in — voting opens at the event. This page will come alive automatically.'
          }
          pulse
        />
      </>
    );
  }

  if (state.voting_state === 'ended') {
    return (
      <>
        {eventHero}
        {qaBanner}
        <StateHero
          emoji="✨"
          title={round === 1 ? 'Qualifier closed — finalists coming soon' : 'Voting closed — results coming soon'}
          subtitle={
            round === 1
              ? 'The top 10 men and women will advance to the Grand Finale on event day!'
              : "The votes are in! This page will switch to the results the moment they're announced."
          }
          pulse
        />
      </>
    );
  }

  const paused = state.voting_state === 'paused';

  async function sendVote(candidate: CandidateWithVotes): Promise<void> {
    setVoting(true);
    try {
      const res = await fetch('/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateId: candidate.id }),
      });
      const body = await res.json();
      if (!res.ok) {
        notify(body.error ?? 'Could not save your vote');
      } else {
        notify(`You voted for ${candidate.name}! 🎉`);
        mutate();
      }
    } finally {
      setVoting(false);
      setConfirming(null);
    }
  }

  return (
    <div className="relative">
      {eventHero}
      {qaBanner}

      {/* Live indicator */}
      <div className="flex items-center gap-2 mb-4">
        <span className={`relative flex h-3 w-3 ${paused ? '' : 'animate-pulse'}`}>
          <span className={`absolute inline-flex h-full w-full rounded-full opacity-60 ${paused ? 'bg-amber-400' : 'bg-green-400 animate-ping'}`} />
          <span className={`relative inline-flex rounded-full h-3 w-3 ${paused ? 'bg-amber-500' : 'bg-green-500'}`} />
        </span>
        <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
          {paused ? 'Voting paused' : 'Live — updates in real time'}
        </span>
      </div>

      {paused && (
        <div className="mb-4 rounded-2xl bg-amber-50 border border-amber-300 px-4 py-3 text-amber-800 font-semibold text-sm flex items-center gap-2">
          ⏸️ Voting is paused right now. Your picks are saved.
        </div>
      )}

      {/* Both categories side by side — left and right — at every screen size */}
      <div className="grid grid-cols-2 gap-3 sm:gap-6 pb-24">
        {(
          [
            ['male', '🤵', 'Male'],
            ['female', '👸', 'Female'],
          ] as [Gender, string, string][]
        ).map(([g, emoji, label]) => (
          <CategorySection
            key={g}
            emoji={emoji}
            label={label}
            gender={g}
            round={round}
            candidates={data.candidates.filter((c) => c.gender === g)}
            myVotes={myVotes[g]}
            canVote={!paused && !voting}
            onVote={setConfirming}
          />
        ))}
      </div>

      {/* Confirm sheet (round 2 only) */}
      <AnimatePresence>
        {confirming && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center"
            onClick={() => setConfirming(null)}
          >
            <motion.div
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-6 text-center"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={confirming.image_url}
                alt={confirming.name}
                className="w-20 h-20 rounded-full object-cover mx-auto border-4 border-brand-100 shadow"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(confirming.name)}`;
                }}
              />
              <h3 className="mt-3 text-lg font-extrabold text-slate-900">
                Vote for {confirming.name}?
              </h3>
              <p className="text-sm text-slate-500 mt-1">
                {confirming.gender && myVotes[confirming.gender].length > 0 && myVotes[confirming.gender][0] !== confirming.id
                  ? 'This will replace your current vote in this category.'
                  : 'You can change your vote anytime while voting is open.'}
              </p>
              <div className="flex gap-3 mt-5">
                <button
                  onClick={() => setConfirming(null)}
                  className="flex-1 rounded-xl border border-slate-300 py-3 font-semibold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  onClick={() => sendVote(confirming)}
                  disabled={voting}
                  className="flex-1 rounded-xl bg-brand-600 py-3 font-bold text-white hover:bg-brand-700 active:scale-[0.98] disabled:opacity-60"
                >
                  {voting ? 'Saving…' : 'Confirm 🗳️'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-sm font-semibold px-5 py-3 rounded-full shadow-xl max-w-[92vw] text-center"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CategorySection({
  emoji,
  label,
  gender,
  round,
  candidates,
  myVotes,
  canVote,
  onVote,
}: {
  emoji: string;
  label: string;
  gender: Gender;
  round: 1 | 2;
  candidates: CandidateWithVotes[];
  myVotes: number[];
  canVote: boolean;
  onVote: (c: CandidateWithVotes) => void;
}) {
  const [search, setSearch] = useState('');
  const maxVotes = Math.max(1, ...candidates.map((c) => c.vote_count));
  const filtered =
    round === 1 && search.trim()
      ? candidates.filter((c) => c.name.toLowerCase().includes(search.trim().toLowerCase()))
      : candidates;

  const chip =
    myVotes.length === 0 && candidates.length > 0 ? (
      <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide bg-brand-50 text-brand-600 px-2 py-0.5 rounded-full">
        Pick one!
      </span>
    ) : (
      myVotes.length > 0 && (
        <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide bg-green-50 text-green-600 px-2 py-0.5 rounded-full">
          ✓ Voted
        </span>
      )
    );

  return (
    <section aria-label={`Most Popular ${label}`} className="min-w-0">
      <div className="sticky top-14 z-30 -mx-1 px-1 py-2 bg-slate-50">
        <div className="rounded-2xl bg-white border border-slate-200 px-3 py-2 flex items-center justify-between gap-2">
          <h2 className="font-extrabold text-slate-900 text-sm sm:text-base truncate">
            {emoji} <span className="hidden sm:inline">Most Popular </span>
            {label}
          </h2>
          {chip}
        </div>
        {round === 1 && candidates.length > 8 && (
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${label.toLowerCase()}…`}
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        )}
      </div>
      {candidates.length === 0 ? (
        <p className="text-sm text-slate-400 bg-white border border-slate-200 rounded-2xl p-5 text-center">
          No {gender} candidates yet.
        </p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-slate-400 bg-white border border-slate-200 rounded-2xl p-5 text-center">
          No match for “{search}”.
        </p>
      ) : (
        <motion.div layout className="grid grid-cols-1 xl:grid-cols-2 gap-2.5 sm:gap-3 mt-1">
          {filtered.map((c, i) => (
            <CandidateCard
              key={c.id}
              candidate={c}
              rank={i + 1}
              maxVotes={maxVotes}
              isMyVote={myVotes.includes(c.id)}
              canVote={canVote}
              neutral={round === 1}
              onVote={onVote}
            />
          ))}
        </motion.div>
      )}
    </section>
  );
}

function StateHero({
  emoji,
  title,
  subtitle,
  pulse,
}: {
  emoji: string;
  title: string;
  subtitle: string;
  pulse?: boolean;
}) {
  return (
    <div className="text-center py-20 px-6">
      <motion.div
        animate={pulse ? { scale: [1, 1.15, 1] } : undefined}
        transition={{ repeat: Infinity, duration: 2 }}
        className="text-6xl mb-4"
      >
        {emoji}
      </motion.div>
      <h2 className="text-2xl font-extrabold text-slate-900">{title}</h2>
      <p className="text-slate-500 mt-2 max-w-sm mx-auto">{subtitle}</p>
    </div>
  );
}
