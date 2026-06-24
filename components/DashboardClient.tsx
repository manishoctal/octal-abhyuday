'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
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

/* ── Countdown ─────────────────────────────────────────── */
function Countdown({ target }: { target: Date }) {
  const [diff, setDiff] = useState(() => target.getTime() - Date.now());
  useEffect(() => {
    const t = setInterval(() => setDiff(target.getTime() - Date.now()), 1000);
    return () => clearInterval(t);
  }, [target]);

  if (diff <= 0) {
    return (
      <div className="flex items-center gap-2 mt-3">
        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        <span className="text-white/90 font-semibold text-sm">Event is live now</span>
      </div>
    );
  }

  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);

  return (
    <div className="flex gap-2 mt-4">
      {([['Days', d], ['Hrs', h], ['Min', m], ['Sec', s]] as [string, number][]).map(([lbl, val]) => (
        <div key={lbl} className="flex-1 flex flex-col items-center bg-white/10 rounded-2xl py-2.5">
          <span className="text-xl font-bold text-white tabular-nums tracking-tight">
            {String(val).padStart(2, '0')}
          </span>
          <span className="text-[9px] font-semibold text-white/50 uppercase tracking-widest mt-0.5">{lbl}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Now / Next ────────────────────────────────────────── */
const TYPE_ICON: Record<string, React.ReactNode> = {
  session:  <Mic size={18} strokeWidth={1.6} style={{ color: '#FE9234' }} />,
  meal:     <UtensilsCrossed size={18} strokeWidth={1.6} style={{ color: '#FE9234' }} />,
  break:    <Coffee size={18} strokeWidth={1.6} style={{ color: '#FE9234' }} />,
  activity: <Target size={18} strokeWidth={1.6} style={{ color: '#FE9234' }} />,
  ceremony: <Award size={18} strokeWidth={1.6} style={{ color: '#FE9234' }} />,
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
  const time = new Date(item.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <Link
      href="/schedule"
      className="card flex items-center gap-4 px-4 py-3.5 active:scale-[0.98] transition-transform"
    >
      {/* Left accent + icon */}
      <div
        className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
        style={{ background: '#FFF4E8' }}
      >
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

/* ── Lucide icon set for Explore tiles ─────────────────── */
const TileIcons: Record<string, (color: string, featured?: boolean) => React.ReactNode> = {
  Schedule: (c, f) => <CalendarDays size={f ? 26 : 22} strokeWidth={1.6} color={c} />,
  Awards:   (c, f) => <Trophy       size={f ? 26 : 22} strokeWidth={1.6} color={c} />,
  Vote:     (c, f) => <Vote         size={f ? 26 : 22} strokeWidth={1.6} color={c} />,
  Gallery:  (c, f) => <ImageIcon    size={f ? 26 : 22} strokeWidth={1.6} color={c} />,
  QnA:      (c, f) => <MessageSquare size={f ? 26 : 22} strokeWidth={1.6} color={c} />,
  Rankings: (c, f) => <BarChart3    size={f ? 26 : 22} strokeWidth={1.6} color={c} />,
  Venue:    (c, f) => <MapPin       size={f ? 26 : 22} strokeWidth={1.6} color={c} />,
  Feedback: (c, f) => <Star         size={f ? 26 : 22} strokeWidth={1.6} color={c} />,
};

/* ── Tile config ───────────────────────────────────────── */
interface Tile {
  href: string;
  iconKey: keyof typeof TileIcons;
  iconColor: string;
  label: string;
  desc: string;
  gradient: string;
  featured?: boolean;
  liveKey?: 'voting' | 'qna';
  show: (v: VotingState) => boolean;
}

const TILES: Tile[] = [
  {
    href: '/schedule', iconKey: 'Schedule', iconColor: '#3B82F6',
    label: 'Schedule', desc: 'Full day agenda & timings',
    gradient: 'linear-gradient(135deg,#EFF6FF 0%,#DBEAFE 100%)',
    featured: true, show: () => true,
  },
  {
    href: '/awards', iconKey: 'Awards', iconColor: '#D97706',
    label: 'Awards', desc: 'Categories & winners',
    gradient: 'linear-gradient(135deg,#FFFBEB 0%,#FEF3C7 100%)',
    featured: true, show: () => true,
  },
  {
    href: '/vote', iconKey: 'Vote', iconColor: '#FE9234',
    label: 'Vote', desc: 'Cast your vote now',
    gradient: 'linear-gradient(135deg,#FFF4E8 0%,#FFEDD5 100%)',
    featured: true, liveKey: 'voting', show: v => v === 'live' || v === 'paused',
  },
  {
    href: '/gallery', iconKey: 'Gallery', iconColor: '#A855F7',
    label: 'Gallery', desc: 'Event photos',
    gradient: 'linear-gradient(135deg,#FDF4FF 0%,#FAE8FF 100%)',
    show: () => true,
  },
  {
    href: '/qna', iconKey: 'QnA', iconColor: '#10B981',
    label: 'Q&A', desc: 'Live questions',
    gradient: 'linear-gradient(135deg,#ECFDF5 0%,#D1FAE5 100%)',
    liveKey: 'qna', show: () => true,
  },
  {
    href: '/leaderboard', iconKey: 'Rankings', iconColor: '#F59E0B',
    label: 'Rankings', desc: 'Top participants',
    gradient: 'linear-gradient(135deg,#FFFBEB 0%,#FEF3C7 100%)',
    show: () => true,
  },
  {
    href: '/info', iconKey: 'Venue', iconColor: '#22C55E',
    label: 'Venue', desc: 'Maps & event info',
    gradient: 'linear-gradient(135deg,#F0FDF4 0%,#DCFCE7 100%)',
    show: () => true,
  },
  {
    href: '/feedback', iconKey: 'Feedback', iconColor: '#FE9234',
    label: 'Feedback', desc: 'Rate the event',
    gradient: 'linear-gradient(135deg,#FFF4E8 0%,#FFEDD5 100%)',
    show: () => true,
  },
];

/* Live badge */
function LiveBadge() {
  return (
    <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold text-white"
      style={{ background: '#EF4444' }}>
      <span className="w-1 h-1 rounded-full bg-white animate-pulse inline-block" />
      LIVE
    </span>
  );
}

function Chevron() {
  return <ChevronRight size={14} strokeWidth={1.6} className="text-slate-300" />;
}

export default function DashboardClient({
  eventName, schedule, votingState, votingRound, isCheckedIn, userName, liveQa,
}: Props) {
  const firstSession = schedule[0];
  const eventDate = firstSession
    ? new Date(firstSession.start_time)
    : new Date(Date.now() + 7 * 86400000);

  const liveModules = { voting: votingState === 'live', qna: !!liveQa };

  const visible  = TILES.filter(t => t.show(votingState));
  const featured = visible.filter(t => t.featured);
  const rest     = visible.filter(t => !t.featured);
  const firstName = userName.split(' ')[0];

  return (
    <div className="space-y-5 pb-4">

      {/* ── Event hero card — Apple Wallet style ──── */}
      <div className="rounded-3xl overflow-hidden" style={{ background: '#0F172A' }}>
        <div className="h-1 w-full" style={{ background: '#FE9234' }} />
        <div className="px-5 pt-4 pb-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: '#FE9234' }}>
            Octal IT Solution
          </p>
          <h1 className="text-2xl font-bold text-white mt-1 leading-tight tracking-tight">
            {eventName}
          </h1>
          <Countdown target={eventDate} />
          <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
            {isCheckedIn ? (
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: '#16A34A' }}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
                <span className="text-white/80 text-sm font-medium">Checked in, {firstName}</span>
              </div>
            ) : (
              <Link href="/me" className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: '#FE9234' }}>
                Get your event badge
                <ChevronRight size={14} strokeWidth={2} />
              </Link>
            )}
            {(votingState === 'live' || liveQa) && (
              <Link href="/live" className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full"
                style={{ background: '#EF4444', color: 'white' }}>
                <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                Live now
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* ── Now / Next ───────────────────────────── */}
      {schedule.length > 0 && <NowNext sessions={schedule} />}

      {/* ── Explore ──────────────────────────────── */}
      <div>
        <p className="section-title mb-3">Explore</p>

        {/* Featured 2-col tiles */}
        {featured.length > 0 && (
          <div className="grid grid-cols-2 gap-2.5 mb-2.5">
            {featured.map(tile => {
              const isLive = tile.liveKey ? liveModules[tile.liveKey] : false;
              const Icon = TileIcons[tile.iconKey];
              return (
                <Link
                  key={tile.href}
                  href={tile.href}
                  className="rounded-3xl active:scale-[0.97] transition-transform flex flex-col justify-between p-4"
                  style={{ background: tile.gradient, minHeight: 112 }}
                >
                  <div className="flex items-start justify-between">
                    <div className="w-11 h-11 rounded-2xl bg-white/60 flex items-center justify-center">
                      {Icon(tile.iconColor, true)}
                    </div>
                    {isLive ? <LiveBadge /> : <Chevron />}
                  </div>
                  <div className="mt-3">
                    <p className="font-bold text-slate-900 text-[15px] leading-tight">{tile.label}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{tile.desc}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Secondary 3-col tiles */}
        <div className="grid grid-cols-3 gap-2.5">
          {rest.map(tile => {
            const isLive = tile.liveKey ? liveModules[tile.liveKey] : false;
            const Icon = TileIcons[tile.iconKey];
            return (
              <Link
                key={tile.href}
                href={tile.href}
                className="rounded-2xl active:scale-[0.97] transition-transform flex flex-col items-start p-3 gap-2 relative overflow-hidden"
                style={{ background: tile.gradient }}
              >
                {isLive && (
                  <span className="absolute top-2 right-2">
                    <LiveBadge />
                  </span>
                )}
                <div className="w-9 h-9 rounded-xl bg-white/60 flex items-center justify-center">
                  {Icon(tile.iconColor)}
                </div>
                <p className="font-semibold text-slate-900 text-[12px] leading-snug">{tile.label}</p>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
