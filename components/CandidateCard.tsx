'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { CandidateWithVotes } from '@/lib/types';

export default function CandidateCard({
  candidate,
  rank,
  maxVotes,
  isMyVote,
  canVote,
  neutral = false,
  onVote,
}: {
  candidate: CandidateWithVotes;
  rank: number;
  maxVotes: number;
  isMyVote: boolean;
  canVote: boolean;
  /** Qualifier mode: no rank, no crown, no counts — just a pick toggle */
  neutral?: boolean;
  onVote: (c: CandidateWithVotes) => void;
}) {
  const [pop, setPop] = useState(false);
  const prevVotes = useRef(candidate.vote_count);

  useEffect(() => {
    if (candidate.vote_count !== prevVotes.current) {
      prevVotes.current = candidate.vote_count;
      setPop(true);
      const t = setTimeout(() => setPop(false), 550);
      return () => clearTimeout(t);
    }
  }, [candidate.vote_count]);

  const share = maxVotes > 0 ? (candidate.vote_count / maxVotes) * 100 : 0;
  const isTop = !neutral && rank === 1 && candidate.vote_count > 0;

  return (
    <motion.div
      layout
      layoutId={`candidate-${candidate.id}`}
      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
      className={`relative bg-white rounded-2xl px-2.5 pt-4 pb-2.5 text-center border transition-shadow ${
        isTop
          ? 'border-amber-300 animate-glow'
          : isMyVote
            ? 'border-brand-400 ring-2 ring-brand-200'
            : 'border-slate-200 shadow-sm'
      }`}
    >
      {/* Rank badge (hidden in neutral/qualifier mode) */}
      {!neutral && (
        <div
          className={`absolute top-2 left-2 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-extrabold ${
            isTop
              ? 'bg-gradient-to-br from-amber-300 to-amber-500 text-white'
              : rank === 2
                ? 'bg-slate-200 text-slate-700'
                : rank === 3
                  ? 'bg-orange-200 text-orange-800'
                  : 'bg-slate-100 text-slate-500'
          }`}
        >
          {rank}
        </div>
      )}

      {isMyVote && (
        <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-brand-600 text-white text-[11px] font-bold flex items-center justify-center shadow">
          ✓
        </span>
      )}

      {/* Photo */}
      <div className="relative inline-block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={candidate.image_url}
          alt={candidate.name}
          className="w-14 h-14 sm:w-16 sm:h-16 rounded-full object-cover bg-slate-100 border-2 border-white shadow mx-auto"
          onError={(e) => {
            (e.target as HTMLImageElement).src =
              `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(candidate.name)}`;
          }}
        />
        {isTop && (
          <motion.span
            initial={{ scale: 0, rotate: -30 }}
            animate={{ scale: 1, rotate: 0 }}
            className="absolute -top-3.5 left-1/2 -translate-x-1/2 text-lg drop-shadow animate-floaty"
          >
            👑
          </motion.span>
        )}
      </div>

      {/* Name */}
      <p className="mt-1.5 font-bold text-slate-900 text-xs sm:text-sm leading-tight truncate" title={candidate.name}>
        {candidate.name}
      </p>

      {/* Vote share bar + count (hidden in neutral/qualifier mode) */}
      {!neutral && (
        <>
          <div className="mt-1.5 h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${isTop ? 'bg-gradient-to-r from-amber-400 to-amber-500' : 'bg-brand-500'}`}
              animate={{ width: `${share}%` }}
              transition={{ type: 'spring', stiffness: 120, damping: 20 }}
            />
          </div>
          <p className={`mt-1 text-[11px] font-semibold text-slate-500 inline-block ${pop ? 'vote-pop' : ''}`}>
            {candidate.vote_count} vote{candidate.vote_count === 1 ? '' : 's'}
          </p>
        </>
      )}

      {/* Vote button */}
      <button
        onClick={() => onVote(candidate)}
        disabled={!canVote}
        className={`mt-1.5 w-full rounded-xl py-1.5 sm:py-2 text-xs sm:text-sm font-bold transition active:scale-95 ${
          isMyVote
            ? 'bg-brand-600 text-white'
            : canVote
              ? 'bg-brand-50 text-brand-700 hover:bg-brand-100'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
        }`}
      >
        {isMyVote ? '✓ Voted' : 'Vote'}
      </button>
    </motion.div>
  );
}
