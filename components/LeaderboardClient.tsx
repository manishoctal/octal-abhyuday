'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { motion } from 'framer-motion';
import { useRealtime } from './useRealtime';
import type { LeaderboardRow } from '@/lib/db';

const fetcher = (url: string) => fetch(url).then(r => r.json());

const ACTIVITY_ICON: Record<string, string> = {
  voted: '🗳️', check_in: '🪪', feedback: '⭐', qa_answer: '💬', photo_upload: '📷',
};

const POINTS_HOW: { icon: string; label: string; pts: number }[] = [
  { icon: '🗳️', label: 'Vote',         pts: 10 },
  { icon: '🪪', label: 'Check-in',     pts: 15 },
  { icon: '📷', label: 'Upload photo', pts: 15 },
  { icon: '⭐', label: 'Feedback',     pts: 20 },
];

interface Props {
  initial: LeaderboardRow[];
  myPoints: number;
  myRank: number | null;
  myId: number;
}

function Avatar({ name, photoUrl, size = 'md' }: { name: string; photoUrl?: string | null; size?: 'sm' | 'md' | 'lg' }) {
  const s = size === 'lg' ? 'w-14 h-14 text-lg' : size === 'md' ? 'w-10 h-10 text-sm' : 'w-8 h-8 text-xs';
  if (photoUrl) return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={photoUrl} alt={name} className={`${s} rounded-full object-cover shrink-0`} />
  );
  return (
    <div
      className={`${s} rounded-full flex items-center justify-center font-bold text-white shrink-0`}
      style={{ background: '#0F172A' }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export default function LeaderboardClient({ initial, myPoints, myRank, myId }: Props) {
  const { data } = useSWR('/api/leaderboard', fetcher, {
    fallbackData: { board: initial, myPoints, myRank },
    refreshInterval: 30000,
  });
  useRealtime(['/api/leaderboard']);

  const [infoOpen, setInfoOpen] = useState(false);

  const board: LeaderboardRow[] = data?.board ?? initial;
  const pts = data?.myPoints ?? myPoints;
  const rank = data?.myRank ?? myRank;

  const activities = (row: LeaderboardRow) =>
    Array.from(new Set(row.activities?.split(',').filter(Boolean) ?? []));

  const podium = board.slice(0, 3);
  const rest   = board.slice(3);
  void rest;

  return (
    <div className="space-y-5 pb-4">

      {/* ── Info banner ───────────────────────────── */}
      <div className="card overflow-hidden">
        <button
          onClick={() => setInfoOpen(o => !o)}
          className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
        >
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-lg" style={{ background: '#FFF4E8' }}>
            🏆
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-slate-900 text-[14px]">Why does the leaderboard matter?</p>
            <p className="text-xs text-slate-400">Tap to see how to earn points</p>
          </div>
          <svg
            width="16" height="16" viewBox="0 0 16 16" fill="none"
            className={`shrink-0 text-slate-400 transition-transform duration-200 ${infoOpen ? 'rotate-180' : ''}`}
          >
            <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {infoOpen && (
          <div className="px-4 pb-4 space-y-4 border-t border-slate-100 pt-3">
            <p className="text-sm text-slate-600 leading-relaxed">
              The leaderboard tracks participation across the event. The more you engage, the higher you climb —
              it&apos;s a fun way to see who&apos;s the most active attendee and celebrate top contributors.
            </p>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">How to earn points</p>
              <div className="grid grid-cols-2 gap-2">
                {POINTS_HOW.map(({ icon, label, pts: p }) => (
                  <div key={label} className="flex items-center gap-2.5 bg-slate-50 rounded-xl px-3 py-2.5">
                    <span className="text-lg">{icon}</span>
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold text-slate-700 truncate">{label}</p>
                      <p className="text-[11px] font-bold" style={{ color: '#FE9234' }}>+{p} pts</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── My score hero card ────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative rounded-[22px] overflow-hidden px-5 py-5"
        style={{
          background: 'linear-gradient(135deg,#FF7A00 0%,#FF4F87 60%,#6B4EFF 100%)',
          boxShadow: '0 10px 28px rgba(255,79,135,0.28)',
        }}
      >
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(135deg,rgba(255,255,255,0.16) 0%,transparent 55%)' }} />
        <div className="relative flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-white/70">My score</p>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-[40px] leading-none font-black text-white tabular-nums">{pts}</span>
              <span className="text-white/70 text-sm font-semibold">pts</span>
            </div>
          </div>
          <div className="flex flex-col items-center justify-center w-16 h-16 rounded-2xl shrink-0" style={{ background: 'rgba(255,255,255,0.18)' }}>
            <span className="text-2xl leading-none">{rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '🏅'}</span>
            <span className="text-white text-[11px] font-bold mt-0.5">{rank ? `#${rank}` : '—'}</span>
          </div>
        </div>

        {/* Progress to next rank */}
        {rank && rank > 1 && (
          (() => {
            const ahead = board[rank - 2];
            const gap = ahead ? ahead.total - pts : 0;
            const prevGap = rank < board.length ? pts - (board[rank] ? board[rank].total : 0) : pts;
            const pct = gap + prevGap > 0 ? Math.max(8, Math.min(92, (prevGap / (gap + prevGap)) * 100)) : 50;
            return gap > 0 ? (
              <div className="relative mt-4">
                <div className="h-1.5 rounded-full bg-white/25 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-white"
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                  />
                </div>
                <p className="text-[11px] text-white/80 font-medium mt-1.5">
                  {gap} pt{gap === 1 ? '' : 's'} to reach #{rank - 1}
                </p>
              </div>
            ) : null;
          })()
        )}

        {/* Earn-more chips */}
        <div className="flex gap-1.5 mt-4 flex-wrap relative">
          {Object.entries(ACTIVITY_ICON).map(([key, icon]) => (
            <span key={key} className="text-[10px] bg-white/15 text-white px-2 py-1 rounded-full font-semibold">
              {icon} {key.replace('_', ' ')}
            </span>
          ))}
        </div>
      </motion.div>

      {board.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-3xl bg-slate-100 flex items-center justify-center text-3xl mb-4">🏆</div>
          <p className="font-semibold text-slate-700">No scores yet</p>
          <p className="text-sm text-slate-400 mt-1">Vote, check in, and give feedback to earn points</p>
        </div>
      )}

      {/* ── Podium top 3 (scales down for 1–2 participants) ── */}
      {podium.length > 0 && (
        <div className="card px-4 py-6 relative overflow-hidden">
          <div
            className="absolute inset-x-0 top-0 h-24 pointer-events-none"
            style={{ background: 'radial-gradient(120% 100% at 50% 0%, rgba(254,146,52,0.10), transparent)' }}
          />
          <p className="section-title mb-4 relative">Podium</p>
          <div className="flex items-end justify-center gap-4 relative">
            {podium.length >= 2 && <PodiumSlot row={podium[1]} place={2} myId={myId} barH="h-16" />}
            <PodiumSlot row={podium[0]} place={1} myId={myId} barH="h-24" />
            {podium.length >= 3 && <PodiumSlot row={podium[2]} place={3} myId={myId} barH="h-12" />}
          </div>
        </div>
      )}

      {/* ── Full list ─────────────────────────────── */}
      {board.length > 0 && (
        <div>
          <p className="section-title mb-2">Rankings</p>
          <div className="space-y-2">
            {board.map((row, idx) => {
              const isMe = row.user_id === myId;
              const acts = activities(row);
              const isTop3 = idx < 3;
              return (
                <motion.div
                  key={row.user_id}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(idx, 8) * 0.04 }}
                  className="card flex items-center gap-3 px-4 py-3"
                  style={{
                    borderLeft: isMe ? '2.5px solid #FE9234' : undefined,
                    background: isTop3 ? 'linear-gradient(90deg, #FFF8F0 0%, white 45%)' : undefined,
                  }}
                >
                  {/* Rank */}
                  <span
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${isTop3 ? 'text-base' : ''}`}
                    style={isTop3 ? { background: '#FFF4E8', color: '#FE9234' } : { color: '#94A3B8' }}
                  >
                    {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                  </span>

                  <Avatar name={row.name} photoUrl={row.profile_photo_url} size="sm" />

                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[14px] text-slate-900 truncate">
                      {row.name}{isMe ? <span className="text-[11px] font-normal text-slate-400 ml-1">(me)</span> : ''}
                    </p>
                    {acts.length > 0 && (
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {acts.slice(0, 4).map(a => ACTIVITY_ICON[a] ?? '·').join(' ')}
                      </p>
                    )}
                  </div>

                  <span className="font-bold text-slate-800 tabular-nums shrink-0">{row.total}</span>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function PodiumSlot({ row, place, myId, barH }: { row: LeaderboardRow; place: number; myId: number; barH: string }) {
  const isMe = row.user_id === myId;
  const barColors = { 1: '#FE9234', 2: '#64748B', 3: '#B45309' };
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: (3 - place) * 0.08, type: 'spring', stiffness: 160, damping: 16 }}
      className="flex flex-col items-center flex-1"
    >
      {/* Avatar */}
      <div className="relative mb-1">
        {place === 1 && <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-lg">👑</span>}
        {row.profile_photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={row.profile_photo_url}
            alt={row.name}
            className="w-11 h-11 rounded-full object-cover shadow-card"
            style={{ outline: `2px solid ${isMe ? '#FE9234' : barColors[place as 1 | 2 | 3]}`, outlineOffset: 2 }}
          />
        ) : (
          <div
            className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-white text-base shadow-card"
            style={{ background: isMe ? '#FE9234' : '#0F172A' }}
          >
            {row.name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
      <p className="text-[11px] font-semibold text-slate-700 truncate max-w-[56px] text-center">
        {row.name.split(' ')[0]}
      </p>
      <p className="text-[10px] text-slate-400">{row.total}pts</p>
      {/* Bar */}
      <div
        className={`w-full ${barH} rounded-t-2xl mt-2 flex items-center justify-center`}
        style={{ background: barColors[place as 1 | 2 | 3] }}
      >
        <span className="text-white font-extrabold text-sm">#{place}</span>
      </div>
    </motion.div>
  );
}
