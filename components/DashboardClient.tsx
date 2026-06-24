'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, MapPin, Clock, Users, Zap } from 'lucide-react';
import type { ScheduleSession, VotingState, VotingRound } from '@/lib/types';

interface Props {
  eventName: string;
  schedule: ScheduleSession[];
  votingState: VotingState;
  votingRound: VotingRound;
  isCheckedIn: boolean;
  userId: number;
  userName: string;
  liveQa?: boolean;
}

/* ── Flip countdown ───────────────────────────────────────── */
interface TimeLeft { days: number; hours: number; minutes: number; seconds: number; done: boolean }

function calcTime(target: Date): TimeLeft {
  const diff = target.getTime() - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, done: true };
  return {
    days:    Math.floor(diff / 86_400_000),
    hours:   Math.floor((diff % 86_400_000) / 3_600_000),
    minutes: Math.floor((diff % 3_600_000) / 60_000),
    seconds: Math.floor((diff % 60_000) / 1_000),
    done: false,
  };
}

function FlipUnit({ value, label, accent = false }: { value: number; label: string; accent?: boolean }) {
  const str = String(value).padStart(2, '0');
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className="relative w-[52px] h-[58px] rounded-xl overflow-hidden flex items-center justify-center"
        style={{
          background: accent
            ? 'linear-gradient(180deg,rgba(249,115,22,0.35) 0%,rgba(194,65,12,0.25) 100%)'
            : 'rgba(255,255,255,0.10)',
          border: accent ? '1px solid rgba(249,115,22,0.5)' : '1px solid rgba(255,255,255,0.12)',
          boxShadow: accent ? '0 0 20px rgba(249,115,22,0.20),inset 0 1px 0 rgba(255,255,255,0.10)' : 'inset 0 1px 0 rgba(255,255,255,0.07)',
        }}
      >
        <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/8 to-transparent pointer-events-none" />
        <div className="absolute inset-x-0 top-1/2 h-px bg-black/30 pointer-events-none" />
        <AnimatePresence mode="popLayout">
          <motion.span
            key={str}
            initial={{ y: '-110%', opacity: 0 }}
            animate={{ y: '0%', opacity: 1 }}
            exit={{ y: '110%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 360, damping: 36 }}
            className={`text-[22px] font-black tabular-nums leading-none ${accent ? 'text-orange-300' : 'text-white'}`}
          >
            {str}
          </motion.span>
        </AnimatePresence>
      </div>
      <span className="text-[9px] font-bold uppercase tracking-[0.12em]" style={{ color: accent ? 'rgba(251,146,60,0.7)' : 'rgba(255,255,255,0.35)' }}>
        {label}
      </span>
    </div>
  );
}

function Colon() {
  return (
    <motion.span
      animate={{ opacity: [1, 0.15, 1] }}
      transition={{ repeat: Infinity, duration: 1, ease: 'easeInOut' }}
      className="text-base font-black pb-5 select-none"
      style={{ color: 'rgba(255,255,255,0.25)' }}
    >
      :
    </motion.span>
  );
}

function Countdown({ target }: { target: Date }) {
  const [time, setTime] = useState<TimeLeft>(() => calcTime(target));
  useEffect(() => {
    const id = setInterval(() => setTime(calcTime(target)), 1000);
    return () => clearInterval(id);
  }, [target]);

  if (time.done) {
    return (
      <div className="flex items-center gap-2 mt-3">
        <span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse shadow-[0_0_8px_#4ade80]" />
        <span className="text-white font-bold text-sm">Event is live now!</span>
      </div>
    );
  }

  return (
    <div className="flex items-end gap-2 mt-4">
      <FlipUnit value={time.days} label="Days" />
      <Colon />
      <FlipUnit value={time.hours} label="Hrs" />
      <Colon />
      <FlipUnit value={time.minutes} label="Min" />
      <Colon />
      <FlipUnit value={time.seconds} label="Sec" accent />
    </div>
  );
}

/* ── Schedule helpers ─────────────────────────────────────── */
const SESSION_EMOJI: Record<string, string> = {
  session: '🎤', meal: '🍽️', break: '☕', activity: '🎯', ceremony: '🏆', default: '📌',
};

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/* ── Today's highlights (inside hero) ────────────────────── */
function TodaysHighlights({ sessions }: { sessions: ScheduleSession[] }) {
  const today = new Date();
  const items = sessions.filter(s => {
    const d = new Date(s.start_time);
    return d.getFullYear() === today.getFullYear() &&
           d.getMonth() === today.getMonth() &&
           d.getDate() === today.getDate();
  }).slice(0, 6);
  if (items.length === 0) return null;

  return (
    <div className="mt-4 pt-4 border-t border-white/10">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/40 mb-2.5 flex items-center gap-1.5">
        <span>✦</span> Today&apos;s Highlights
      </p>
      <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
        {items.map(s => {
          const isNow = new Date(s.start_time).getTime() <= Date.now() &&
                        (!s.end_time || new Date(s.end_time).getTime() > Date.now());
          return (
            <Link
              key={s.id}
              href="/schedule"
              className="flex items-center gap-2.5 px-3 py-2 rounded-2xl shrink-0 border transition-all active:scale-95"
              style={{
                background: isNow ? 'rgba(249,115,22,0.15)' : 'rgba(255,255,255,0.07)',
                borderColor: isNow ? 'rgba(249,115,22,0.4)' : 'rgba(255,255,255,0.10)',
              }}
            >
              <span className="text-base leading-none">{SESSION_EMOJI[s.type] ?? SESSION_EMOJI.default}</span>
              <div className="min-w-0">
                <p className="text-white text-xs font-semibold truncate max-w-[100px]">{s.title}</p>
                <p className="text-[10px] font-medium mt-0.5" style={{ color: isNow ? '#fb923c' : 'rgba(255,255,255,0.4)' }}>
                  {isNow ? 'In Progress' : fmtTime(s.start_time)}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/* ── Up Next card ────────────────────────────────────────── */
function UpNext({ sessions }: { sessions: ScheduleSession[] }) {
  const now = Date.now();
  const ongoing = sessions.find(s =>
    new Date(s.start_time).getTime() <= now && s.end_time && new Date(s.end_time).getTime() > now
  );
  const upcoming = sessions.find(s => new Date(s.start_time).getTime() > now);
  const item = ongoing ?? upcoming;
  if (!item) return null;

  const isOngoing = !!ongoing;
  const diffMs = new Date(item.start_time).getTime() - now;
  const diffMin = Math.round(diffMs / 60000);

  return (
    <Link href="/schedule" className="block active:scale-[0.98] transition-transform">
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex items-center gap-4 px-4 py-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0"
            style={{ background: '#FFF4E8' }}>
            {SESSION_EMOJI[item.type] ?? SESSION_EMOJI.default}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#FE9234' }}>
              {isOngoing ? 'Happening now' : 'Up next'}
            </p>
            <p className="font-bold text-slate-900 text-[15px] truncate mt-0.5">{item.title}</p>
            <div className="flex items-center gap-3 mt-1">
              <span className="flex items-center gap-1 text-xs text-slate-400">
                <Clock size={11} strokeWidth={1.8} />
                {fmtTime(item.start_time)}
              </span>
              {item.location && (
                <span className="flex items-center gap-1 text-xs text-slate-400">
                  <MapPin size={11} strokeWidth={1.8} />
                  {item.location}
                </span>
              )}
            </div>
          </div>
          <ChevronRight size={16} strokeWidth={1.8} className="text-slate-300 shrink-0" />
        </div>
        {!isOngoing && diffMin > 0 && diffMin < 60 && (
          <div className="px-4 pb-3">
            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full"
              style={{ background: '#FFF4E8', color: '#FE9234' }}>
              Starts in {diffMin} min
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}

/* ── Stats row ───────────────────────────────────────────── */
function StatsRow({ sessionCount, isCheckedIn }: { sessionCount: number; isCheckedIn: boolean }) {
  const stats = [
    { emoji: '📅', value: String(sessionCount), label: 'Sessions' },
    { emoji: '✅', value: isCheckedIn ? 'Done' : 'Pending', label: 'Check-in' },
    { emoji: '🎤', value: 'Live', label: 'Stage' },
    { emoji: '🏆', value: 'Awards', label: 'Tonight' },
  ];

  return (
    <div className="grid grid-cols-4 gap-2">
      {stats.map(s => (
        <div key={s.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm px-2 py-3 flex flex-col items-center gap-1">
          <span className="text-xl leading-none">{s.emoji}</span>
          <p className="font-black text-slate-900 text-sm leading-tight">{s.value}</p>
          <p className="text-[10px] text-slate-400 font-medium leading-none">{s.label}</p>
        </div>
      ))}
    </div>
  );
}

/* ── Explore tiles ──────────────────────────────────────── */
interface Tile {
  href: string;
  emoji: string;
  label: string;
  desc: string;
  stat?: string;
  gradient: string;
  shimmer?: boolean;
  liveKey?: 'voting' | 'qna';
  show: (v: VotingState) => boolean;
}

const TILES: Tile[] = [
  {
    href: '/schedule',
    emoji: '📅',
    label: 'Schedule',
    desc: 'Full day agenda',
    gradient: 'linear-gradient(140deg,#1e3a8a 0%,#1d4ed8 60%,#3b82f6 100%)',
    show: () => true,
  },
  {
    href: '/awards',
    emoji: '🏆',
    label: 'Awards',
    desc: 'Categories & winners',
    gradient: 'linear-gradient(140deg,#78350f 0%,#b45309 55%,#f59e0b 100%)',
    show: () => true,
  },
  {
    href: '/gallery',
    emoji: '📸',
    label: 'Gallery',
    desc: 'Event photos',
    gradient: 'linear-gradient(140deg,#581c87 0%,#7e22ce 55%,#a855f7 100%)',
    show: () => true,
  },
  {
    href: '/vote',
    emoji: '🗳️',
    label: 'Vote',
    desc: 'Cast your vote',
    gradient: 'linear-gradient(140deg,#7c2d12 0%,#c2410c 55%,#f97316 100%)',
    liveKey: 'voting',
    show: v => v === 'live' || v === 'paused',
  },
  {
    href: '/qna',
    emoji: '💬',
    label: 'Q&A',
    desc: 'Live questions',
    gradient: 'linear-gradient(140deg,#064e3b 0%,#047857 55%,#10b981 100%)',
    liveKey: 'qna',
    show: () => true,
  },
  {
    href: '/leaderboard',
    emoji: '🥇',
    label: 'Rankings',
    desc: 'Top participants',
    gradient: 'linear-gradient(140deg,#831843 0%,#be185d 55%,#ec4899 100%)',
    show: () => true,
  },
  {
    href: '/me',
    emoji: '👤',
    label: 'My Badge',
    desc: 'QR check-in',
    gradient: 'linear-gradient(140deg,#0c4a6e 0%,#0369a1 55%,#0ea5e9 100%)',
    show: () => true,
  },
  {
    href: '/info',
    emoji: '📍',
    label: 'Venue',
    desc: 'Maps & event info',
    gradient: 'linear-gradient(140deg,#134e4a 0%,#0f766e 55%,#14b8a6 100%)',
    show: () => true,
  },
  {
    href: '/feedback',
    emoji: '⭐',
    label: 'Feedback',
    desc: 'Rate the event',
    gradient: 'linear-gradient(140deg,#4c0519 0%,#9f1239 55%,#f43f5e 100%)',
    show: () => true,
  },
];

function LiveBadge() {
  return (
    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold text-white"
      style={{ background: '#EF4444' }}>
      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
      LIVE
    </span>
  );
}

/* ── Main component ──────────────────────────────────────── */
export default function DashboardClient({
  eventName, schedule, votingState, isCheckedIn, userName, liveQa,
}: Props) {
  const firstSession = schedule[0];
  const eventDate = firstSession
    ? new Date(firstSession.start_time)
    : new Date(Date.now() + 7 * 86400000);

  const anyLive = votingState === 'live' || !!liveQa;
  const liveModules = { voting: votingState === 'live', qna: !!liveQa };
  const visible = TILES.filter(t => t.show(votingState));
  const firstName = userName.split(' ')[0];

  return (
    <div className="space-y-4 pb-4">

      {/* ── Hero card ── */}
      <div
        className="rounded-3xl overflow-hidden relative"
        style={{ background: 'linear-gradient(150deg,#020617 0%,#0f1535 30%,#1e1b4b 65%,#0f172a 100%)' }}
      >
        {/* Ambient glow blobs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute w-64 h-64 rounded-full blur-3xl"
            style={{ background: 'radial-gradient(circle,rgba(124,58,237,0.25),transparent)', top: '-30%', right: '-15%' }} />
          <div className="absolute w-48 h-48 rounded-full blur-3xl"
            style={{ background: 'radial-gradient(circle,rgba(249,115,22,0.18),transparent)', bottom: '-10%', left: '-5%' }} />
          <div className="absolute w-32 h-32 rounded-full blur-2xl"
            style={{ background: 'radial-gradient(circle,rgba(59,130,246,0.15),transparent)', top: '20%', left: '40%' }} />
        </div>

        {/* Sparkle dots */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {[
            { top: '8%', left: '12%', delay: '0s', size: 3 },
            { top: '15%', right: '20%', delay: '0.7s', size: 2 },
            { top: '45%', right: '8%', delay: '1.3s', size: 3 },
            { top: '30%', left: '30%', delay: '0.4s', size: 2 },
            { top: '70%', right: '25%', delay: '1.8s', size: 2 },
          ].map((d, i) => (
            <motion.div
              key={i}
              className="absolute rounded-full bg-white"
              style={{ top: d.top, left: (d as {left?: string}).left, right: (d as {right?: string}).right, width: d.size, height: d.size }}
              animate={{ opacity: [0.15, 0.8, 0.15], scale: [0.8, 1.3, 0.8] }}
              transition={{ repeat: Infinity, duration: 2.5, delay: parseFloat(d.delay) }}
            />
          ))}
        </div>

        <div className="relative px-5 pt-5 pb-5">
          {/* LIVE badge top-right */}
          {anyLive && (
            <Link
              href="/live"
              className="absolute top-5 right-5 flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-full z-10"
              style={{ background: '#EF4444', color: 'white', boxShadow: '0 0 12px rgba(239,68,68,0.5)' }}
            >
              <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
              LIVE NOW
            </Link>
          )}

          {/* Event name */}
          <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: 'rgba(251,146,60,0.75)' }}>
            Octal IT Solutions
          </p>
          <h1 className="text-[28px] font-black text-white mt-1 leading-tight tracking-tight pr-24">
            {eventName}
          </h1>
          <p className="text-white/35 text-[11px] font-semibold mt-1 tracking-widest uppercase">
            Celebrate · Compete · Connect
          </p>

          {/* Countdown */}
          <Countdown target={eventDate} />

          {/* Check-in row */}
          <div className="mt-4 flex items-center justify-between">
            {isCheckedIn ? (
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ background: '#16A34A' }}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <span className="text-white/80 text-sm font-semibold">Checked in, {firstName}!</span>
              </div>
            ) : (
              <Link href="/me"
                className="flex items-center gap-1.5 text-sm font-bold px-3 py-1.5 rounded-full border transition-all active:scale-95"
                style={{ color: '#FE9234', borderColor: 'rgba(249,115,22,0.35)', background: 'rgba(249,115,22,0.08)' }}>
                Get your event badge
                <ChevronRight size={13} strokeWidth={2.2} />
              </Link>
            )}
          </div>

          {/* Today highlights */}
          {schedule.length > 0 && <TodaysHighlights sessions={schedule} />}
        </div>
      </div>

      {/* ── Stats row ── */}
      <StatsRow sessionCount={schedule.length} isCheckedIn={isCheckedIn} />

      {/* ── Up Next ── */}
      {schedule.length > 0 && <UpNext sessions={schedule} />}

      {/* ── Explore ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[12px] font-black uppercase tracking-[0.12em] text-slate-500">Explore</p>
          <Link href="/schedule" className="flex items-center gap-0.5 text-[11px] font-bold" style={{ color: '#FE9234' }}>
            See all <ChevronRight size={12} strokeWidth={2.5} />
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {visible.map(tile => {
            const isLive = tile.liveKey ? liveModules[tile.liveKey] : false;
            return (
              <Link
                key={tile.href}
                href={tile.href}
                className="rounded-3xl overflow-hidden flex flex-col justify-between p-4 relative active:scale-[0.96] transition-transform"
                style={{ background: tile.gradient, minHeight: 138 }}
              >
                {/* Shimmer overlay */}
                <div className="absolute inset-0 pointer-events-none rounded-3xl"
                  style={{ background: 'linear-gradient(135deg,rgba(255,255,255,0.08) 0%,transparent 50%)' }} />

                {/* Top row: emoji + badge */}
                <div className="flex items-start justify-between relative z-10">
                  <span className="text-[36px] leading-none drop-shadow-lg">{tile.emoji}</span>
                  {isLive ? (
                    <LiveBadge />
                  ) : (
                    <div className="w-7 h-7 rounded-full flex items-center justify-center"
                      style={{ background: 'rgba(255,255,255,0.15)' }}>
                      <ChevronRight size={13} strokeWidth={2.2} className="text-white" />
                    </div>
                  )}
                </div>

                {/* Bottom: label + desc */}
                <div className="relative z-10 mt-2">
                  <p className="font-black text-white text-[15px] leading-tight">{tile.label}</p>
                  <p className="text-[11px] mt-0.5 leading-snug" style={{ color: 'rgba(255,255,255,0.6)' }}>{tile.desc}</p>
                  {isLive && (
                    <span className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(255,255,255,0.2)', color: 'white' }}>
                      <Zap size={9} strokeWidth={2.5} />
                      Live Now
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* ── Attendees strip ── */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm px-5 py-4 flex items-center gap-3">
        <div className="flex items-center -space-x-2">
          {['🧑', '👩', '👨', '🙋'].map((e, i) => (
            <div key={i} className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-100 to-orange-200 border-2 border-white flex items-center justify-center text-sm shadow-sm">
              {e}
            </div>
          ))}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-slate-900 text-sm">Join the celebration</p>
          <p className="text-xs text-slate-400">Participants are already active</p>
        </div>
        <Link href="/leaderboard" className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full"
          style={{ background: '#FFF4E8', color: '#FE9234' }}>
          <Users size={11} strokeWidth={2} />
          View
        </Link>
      </div>

    </div>
  );
}
