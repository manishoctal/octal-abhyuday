'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CalendarDays, Trophy, Vote, ImageIcon, MessageSquare,
  BarChart3, MapPin, Star, ChevronRight, Mic, UtensilsCrossed,
  Coffee, Target, Award,
} from 'lucide-react';
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

/* ── Flip countdown (like stage view, adapted for mobile card) ── */
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

function FlipDigit({ value, accent = false }: { value: number; accent?: boolean }) {
  const str = String(value).padStart(2, '0');
  return (
    <div
      className="relative w-[54px] h-[64px] rounded-xl overflow-hidden flex items-center justify-center"
      style={{
        background: accent
          ? 'linear-gradient(180deg,rgba(254,146,52,0.22) 0%,rgba(120,53,15,0.18) 100%)'
          : 'rgba(255,255,255,0.06)',
        border: accent ? '1px solid rgba(254,146,52,0.4)' : '1px solid rgba(255,255,255,0.1)',
        boxShadow: accent ? '0 0 18px rgba(251,191,36,0.12)' : 'none',
      }}
    >
      <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/6 to-transparent pointer-events-none" />
      <div className="absolute inset-x-0 top-1/2 h-px bg-black/40 pointer-events-none" />
      <AnimatePresence mode="popLayout">
        <motion.span
          key={str}
          initial={{ y: '-110%', opacity: 0 }}
          animate={{ y: '0%',    opacity: 1 }}
          exit={{    y: '110%',  opacity: 0 }}
          transition={{ type: 'spring', stiffness: 360, damping: 36 }}
          className={`text-2xl font-black tabular-nums ${accent ? 'text-amber-300' : 'text-white'}`}
        >
          {str}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

function FlipColon() {
  return (
    <motion.span
      animate={{ opacity: [1, 0.2, 1] }}
      transition={{ repeat: Infinity, duration: 1, ease: 'easeInOut' }}
      className="text-lg font-black text-white/30 pb-3 select-none"
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
        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        <span className="text-white/90 font-semibold text-sm">Event is live now!</span>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/35 mb-2.5">
        Countdown to the event
      </p>
      <div className="flex items-end gap-1.5">
        <div className="flex flex-col items-center gap-1">
          <FlipDigit value={time.days} />
          <span className="text-[9px] font-bold uppercase tracking-widest text-white/30">Days</span>
        </div>
        <FlipColon />
        <div className="flex flex-col items-center gap-1">
          <FlipDigit value={time.hours} />
          <span className="text-[9px] font-bold uppercase tracking-widest text-white/30">Hrs</span>
        </div>
        <FlipColon />
        <div className="flex flex-col items-center gap-1">
          <FlipDigit value={time.minutes} />
          <span className="text-[9px] font-bold uppercase tracking-widest text-white/30">Min</span>
        </div>
        <FlipColon />
        <div className="flex flex-col items-center gap-1">
          <FlipDigit value={time.seconds} accent />
          <span className="text-[9px] font-bold uppercase tracking-widest text-amber-400/50">Sec</span>
        </div>
      </div>
    </div>
  );
}

/* ── Now / Next ─────────────────────────────────────────── */
const TYPE_ICON: Record<string, React.ReactNode> = {
  session:  <Mic          size={18} strokeWidth={1.6} style={{ color: '#FE9234' }} />,
  meal:     <UtensilsCrossed size={18} strokeWidth={1.6} style={{ color: '#FE9234' }} />,
  break:    <Coffee       size={18} strokeWidth={1.6} style={{ color: '#FE9234' }} />,
  activity: <Target       size={18} strokeWidth={1.6} style={{ color: '#FE9234' }} />,
  ceremony: <Award        size={18} strokeWidth={1.6} style={{ color: '#FE9234' }} />,
};

function NowNext({ sessions }: { sessions: ScheduleSession[] }) {
  const now = Date.now();
  const ongoing = sessions.find(s =>
    new Date(s.start_time).getTime() <= now && s.end_time && new Date(s.end_time).getTime() > now
  );
  const upcoming = sessions.find(s => new Date(s.start_time).getTime() > now);
  const item = ongoing ?? upcoming;
  if (!item) return null;

  const label = ongoing ? 'Happening now' : 'Up next';
  const time  = new Date(item.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <Link
      href="/schedule"
      className="card flex items-center gap-4 px-4 py-3.5 active:scale-[0.98] transition-transform"
    >
      <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0" style={{ background: '#FFF4E8' }}>
        {TYPE_ICON[item.type] ?? <CalendarDays size={18} strokeWidth={1.6} style={{ color: '#FE9234' }} />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#FE9234' }}>{label}</p>
        <p className="font-semibold text-slate-900 text-[14px] truncate mt-0.5">{item.title}</p>
        <p className="text-xs text-slate-400 mt-0.5">
          {time}{item.location ? ` · ${item.location}` : ''}
        </p>
      </div>
      <ChevronRight size={16} strokeWidth={1.6} className="shrink-0 text-slate-300" />
    </Link>
  );
}

/* ── Tile icons ─────────────────────────────────────────── */
const TileIcons: Record<string, (color: string) => React.ReactNode> = {
  Schedule: c => <CalendarDays  size={24} strokeWidth={1.6} color={c} />,
  Awards:   c => <Trophy        size={24} strokeWidth={1.6} color={c} />,
  Vote:     c => <Vote          size={24} strokeWidth={1.6} color={c} />,
  Gallery:  c => <ImageIcon     size={24} strokeWidth={1.6} color={c} />,
  QnA:      c => <MessageSquare size={24} strokeWidth={1.6} color={c} />,
  Rankings: c => <BarChart3     size={24} strokeWidth={1.6} color={c} />,
  Venue:    c => <MapPin        size={24} strokeWidth={1.6} color={c} />,
  Feedback: c => <Star          size={24} strokeWidth={1.6} color={c} />,
};

/* ── Tile config ─────────────────────────────────────────── */
interface Tile {
  href: string;
  iconKey: keyof typeof TileIcons;
  iconColor: string;
  iconBg: string;
  label: string;
  desc: string;
  gradient: string;
  liveKey?: 'voting' | 'qna';
  show: (v: VotingState) => boolean;
}

const TILES: Tile[] = [
  {
    href: '/schedule', iconKey: 'Schedule', iconColor: '#3B82F6', iconBg: '#EFF6FF',
    label: 'Schedule', desc: 'Full day agenda',
    gradient: 'linear-gradient(145deg,#F8FAFF 0%,#EFF6FF 100%)',
    show: () => true,
  },
  {
    href: '/awards', iconKey: 'Awards', iconColor: '#D97706', iconBg: '#FFFBEB',
    label: 'Awards', desc: 'Categories & winners',
    gradient: 'linear-gradient(145deg,#FFFEF7 0%,#FEF3C7 100%)',
    show: () => true,
  },
  {
    href: '/vote', iconKey: 'Vote', iconColor: '#FE9234', iconBg: '#FFF4E8',
    label: 'Vote', desc: 'Cast your vote',
    gradient: 'linear-gradient(145deg,#FFFAF5 0%,#FFEDD5 100%)',
    liveKey: 'voting', show: v => v === 'live' || v === 'paused',
  },
  {
    href: '/gallery', iconKey: 'Gallery', iconColor: '#A855F7', iconBg: '#FDF4FF',
    label: 'Gallery', desc: 'Event photos',
    gradient: 'linear-gradient(145deg,#FEF9FF 0%,#FAE8FF 100%)',
    show: () => true,
  },
  {
    href: '/qna', iconKey: 'QnA', iconColor: '#10B981', iconBg: '#ECFDF5',
    label: 'Q&A', desc: 'Live questions',
    gradient: 'linear-gradient(145deg,#F3FDFB 0%,#D1FAE5 100%)',
    liveKey: 'qna', show: () => true,
  },
  {
    href: '/leaderboard', iconKey: 'Rankings', iconColor: '#F59E0B', iconBg: '#FFFBEB',
    label: 'Rankings', desc: 'Top participants',
    gradient: 'linear-gradient(145deg,#FFFEF7 0%,#FEF3C7 100%)',
    show: () => true,
  },
  {
    href: '/info', iconKey: 'Venue', iconColor: '#22C55E', iconBg: '#F0FDF4',
    label: 'Venue', desc: 'Maps & event info',
    gradient: 'linear-gradient(145deg,#F6FEF8 0%,#DCFCE7 100%)',
    show: () => true,
  },
  {
    href: '/feedback', iconKey: 'Feedback', iconColor: '#F43F5E', iconBg: '#FFF1F2',
    label: 'Feedback', desc: 'Rate the event',
    gradient: 'linear-gradient(145deg,#FFF8F9 0%,#FFE4E6 100%)',
    show: () => true,
  },
];

/* ── Live badge ─────────────────────────────────────────── */
function LiveBadge() {
  return (
    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold text-white"
      style={{ background: '#EF4444' }}>
      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse inline-block" />
      LIVE
    </span>
  );
}

export default function DashboardClient({
  eventName, schedule, votingState, isCheckedIn, userName, liveQa,
}: Props) {
  const firstSession = schedule[0];
  const eventDate = firstSession
    ? new Date(firstSession.start_time)
    : new Date(Date.now() + 7 * 86400000);

  const liveModules = { voting: votingState === 'live', qna: !!liveQa };
  const visible     = TILES.filter(t => t.show(votingState));
  const firstName   = userName.split(' ')[0];

  return (
    <div className="space-y-5 pb-4">

      {/* ── Event hero card ── */}
      <div className="rounded-3xl overflow-hidden relative" style={{ background: '#0F172A' }}>
        {/* Top accent bar */}
        <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg,#FE9234,#F97316,#FE9234)' }} />
        {/* Ambient glow */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
          <div className="absolute w-48 h-48 rounded-full opacity-10 blur-3xl"
            style={{ background: '#4338ca', top: '-20%', right: '-10%' }} />
        </div>
        <div className="relative px-5 pt-4 pb-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: '#FE9234' }}>
            Octal IT Solutions
          </p>
          <h1 className="text-2xl font-bold text-white mt-1 leading-tight tracking-tight">
            {eventName}
          </h1>
          <Countdown target={eventDate} />
          <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
            {isCheckedIn ? (
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: '#16A34A' }}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span className="text-white/80 text-sm font-medium">Checked in, {firstName}</span>
              </div>
            ) : (
              <Link href="/me" className="flex items-center gap-1.5 text-sm font-semibold"
                style={{ color: '#FE9234' }}>
                Get your event badge
                <ChevronRight size={14} strokeWidth={2} />
              </Link>
            )}
            {(votingState === 'live' || liveQa) && (
              <Link href="/live"
                className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full"
                style={{ background: '#EF4444', color: 'white' }}>
                <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                Live now
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* ── Now / Next ── */}
      {schedule.length > 0 && <NowNext sessions={schedule} />}

      {/* ── Explore ── */}
      <div>
        <p className="section-title mb-3">Explore</p>
        <div className="grid grid-cols-2 gap-3">
          {visible.map(tile => {
            const isLive = tile.liveKey ? liveModules[tile.liveKey] : false;
            const Icon   = TileIcons[tile.iconKey];
            return (
              <Link
                key={tile.href}
                href={tile.href}
                className="rounded-3xl active:scale-[0.97] transition-transform flex flex-col justify-between p-4 relative overflow-hidden"
                style={{ background: tile.gradient, minHeight: 130 }}
              >
                {/* Subtle inner shadow for depth */}
                <div className="absolute inset-0 rounded-3xl pointer-events-none"
                  style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.8), inset 0 -1px 0 rgba(0,0,0,0.04)' }} />

                <div className="flex items-start justify-between relative">
                  <div
                    className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-sm"
                    style={{ background: tile.iconBg }}
                  >
                    {Icon(tile.iconColor)}
                  </div>
                  {isLive && (
                    <span className="mt-0.5">
                      <LiveBadge />
                    </span>
                  )}
                  {!isLive && (
                    <ChevronRight size={14} strokeWidth={1.8} className="text-slate-300 mt-0.5" />
                  )}
                </div>

                <div className="mt-3 relative">
                  <p className="font-bold text-slate-900 text-[15px] leading-tight">{tile.label}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{tile.desc}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
