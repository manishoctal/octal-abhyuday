'use client';

import useSWR from 'swr';
import { useRealtime } from './useRealtime';
import type { LeaderboardRow } from '@/lib/db';

const fetcher = (url: string) => fetch(url).then(r => r.json());

const ACTIVITY_ICON: Record<string, string> = {
  voted: '🗳️', check_in: '🪪', feedback: '⭐', qa_answer: '💬', photo_upload: '📷',
};

interface Props {
  initial: LeaderboardRow[];
  myPoints: number;
  myRank: number | null;
  myId: number;
}

function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const s = size === 'lg' ? 'w-14 h-14 text-lg' : size === 'md' ? 'w-10 h-10 text-sm' : 'w-8 h-8 text-xs';
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

  const board: LeaderboardRow[] = data?.board ?? initial;
  const pts = data?.myPoints ?? myPoints;
  const rank = data?.myRank ?? myRank;

  const activities = (row: LeaderboardRow) =>
    Array.from(new Set(row.activities?.split(',').filter(Boolean) ?? []));

  const podium = board.slice(0, 3);
  const rest   = board.slice(3);

  return (
    <div className="space-y-5 pb-4">

      {/* ── My score card ─────────────────────────── */}
      <div className="card px-5 py-4" style={{ borderLeft: '3px solid #FE9234' }}>
        <p className="section-title">My Score</p>
        <div className="flex items-end justify-between mt-1">
          <div>
            <span className="text-4xl font-bold text-slate-900 tabular-nums">{pts}</span>
            <span className="text-slate-400 text-sm font-medium ml-1.5">points</span>
          </div>
          {rank ? (
            <span
              className="text-sm font-bold px-3 py-1 rounded-full"
              style={{ background: '#FFF4E8', color: '#FE9234' }}
            >
              #{rank}
            </span>
          ) : (
            <span className="text-xs text-slate-400">Not ranked yet</span>
          )}
        </div>
        {/* Earn-more chips */}
        <div className="flex gap-2 mt-3 flex-wrap">
          {Object.entries(ACTIVITY_ICON).map(([key, icon]) => (
            <span key={key} className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-medium">
              {icon} {key.replace('_', ' ')}
            </span>
          ))}
        </div>
      </div>

      {board.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-3xl bg-slate-100 flex items-center justify-center text-3xl mb-4">🏆</div>
          <p className="font-semibold text-slate-700">No scores yet</p>
          <p className="text-sm text-slate-400 mt-1">Vote, check in, and give feedback to earn points</p>
        </div>
      )}

      {/* ── Podium top 3 ──────────────────────────── */}
      {podium.length >= 3 && (
        <div className="card px-4 py-5">
          <p className="section-title mb-4">Podium</p>
          <div className="flex items-end justify-center gap-4">
            {/* 2nd — left */}
            <PodiumSlot row={podium[1]} place={2} myId={myId} barH="h-16" />
            {/* 1st — center, tallest */}
            <PodiumSlot row={podium[0]} place={1} myId={myId} barH="h-24" />
            {/* 3rd — right */}
            <PodiumSlot row={podium[2]} place={3} myId={myId} barH="h-12" />
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
              return (
                <div
                  key={row.user_id}
                  className="card flex items-center gap-3 px-4 py-3"
                  style={isMe ? { borderLeft: '2.5px solid #FE9234' } : {}}
                >
                  {/* Rank */}
                  <span className="w-7 text-center font-bold text-sm shrink-0" style={{ color: idx < 3 ? '#FE9234' : '#94A3B8' }}>
                    {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                  </span>

                  <Avatar name={row.name} size="sm" />

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
                </div>
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
    <div className="flex flex-col items-center flex-1">
      {/* Avatar */}
      <div
        className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-white text-base mb-1 shadow-card"
        style={{ background: isMe ? '#FE9234' : '#0F172A' }}
      >
        {row.name.charAt(0).toUpperCase()}
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
    </div>
  );
}
