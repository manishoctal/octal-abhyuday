'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useSWR from 'swr';
import {
  ChevronRight, MapPin, Clock, QrCode, CalendarDays, Trophy,
  Vote, ImageIcon, MessageSquare, BarChart3, Star, Mic,
  UtensilsCrossed, Coffee, Target, Award, Zap, CheckCircle2,
} from 'lucide-react';
import type { ScheduleSession, VotingState, VotingRound } from '@/lib/types';

const fetcher = (url: string) => fetch(url).then(r => r.json());

interface Props {
  eventName:    string;
  schedule:     ScheduleSession[];
  votingState:  VotingState;
  votingRound:  VotingRound;
  isCheckedIn:  boolean;
  userId:       number;
  userName:     string;
  liveQa?:      boolean;
  participants?: number;
  awardCount?:   number;
  moduleVisibility?: Record<string, boolean>;
  moduleEnabled?:    Record<string, boolean>;
  eventCountdownDate?: string | null;
}

/* ── Countdown ─────────────────────────────────────────────── */
interface TL { days:number; hours:number; minutes:number; seconds:number; done:boolean }
function calc(t: Date): TL {
  const d = t.getTime() - Date.now();
  if (d <= 0) return { days:0, hours:0, minutes:0, seconds:0, done:true };
  return {
    days:    Math.floor(d / 86400000),
    hours:   Math.floor((d % 86400000) / 3600000),
    minutes: Math.floor((d % 3600000) / 60000),
    seconds: Math.floor((d % 60000) / 1000),
    done:    false,
  };
}

function FlipUnit({ value, label, accent = false }: { value:number; label:string; accent?:boolean }) {
  const str = String(value).padStart(2, '0');
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className="relative w-[52px] h-[60px] rounded-[14px] overflow-hidden flex items-center justify-center"
        style={{
          background: accent
            ? 'linear-gradient(180deg,rgba(255,122,0,0.28) 0%,rgba(194,65,12,0.18) 100%)'
            : 'rgba(255,255,255,0.09)',
          border: accent ? '1px solid rgba(255,122,0,0.40)' : '1px solid rgba(255,255,255,0.10)',
        }}
      >
        {/* Divider line */}
        <div className="absolute inset-x-0 top-1/2 h-px bg-black/25 pointer-events-none" />
        {/* Top sheen */}
        <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/[0.06] to-transparent pointer-events-none" />

        {/* Single number — mode="wait" ensures only one renders at a time */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={str}
            initial={{ y: '-80%', opacity: 0 }}
            animate={{ y: '0%',   opacity: 1 }}
            exit={{   y: '80%',   opacity: 0 }}
            transition={{ duration: 0.14, ease: 'easeInOut' }}
            className={`text-[22px] font-black tabular-nums leading-none select-none ${accent ? 'text-orange-300' : 'text-white'}`}
          >
            {str}
          </motion.span>
        </AnimatePresence>
      </div>
      <span
        className="text-[9px] font-bold uppercase tracking-[0.13em] select-none"
        style={{ color: accent ? 'rgba(251,146,60,0.65)' : 'rgba(255,255,255,0.30)' }}
      >
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
      className="text-[18px] font-black pb-[22px] select-none"
      style={{ color: 'rgba(255,255,255,0.20)' }}
    >
      :
    </motion.span>
  );
}

function Countdown({ target }: { target: Date }) {
  const [t, setT] = useState<TL | null>(null);
  useEffect(() => {
    setT(calc(target));
    const id = setInterval(() => setT(calc(target)), 1000);
    return () => clearInterval(id);
  }, [target]);

  if (!t) return <div className="h-[82px] mt-4" />;

  if (t.done) return (
    <div className="flex items-center gap-2 mt-4">
      <span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" style={{ boxShadow: '0 0 8px #4ade80' }} />
      <span className="text-white font-bold text-sm">Event is live!</span>
    </div>
  );

  return (
    <div className="flex items-end gap-2 mt-4">
      <FlipUnit value={t.days}    label="Days" />
      <Colon />
      <FlipUnit value={t.hours}   label="Hrs" />
      <Colon />
      <FlipUnit value={t.minutes} label="Min" />
      <Colon />
      <FlipUnit value={t.seconds} label="Sec" accent />
    </div>
  );
}

/* ── Schedule helpers ───────────────────────────────────────── */
const SESSION_EMOJI: Record<string, string> = {
  session: '🎤', meal: '🍽️', break: '☕', activity: '🎯', ceremony: '🏆',
};
const SESSION_ICON: Record<string, React.ReactNode> = {
  session:  <Mic size={16} strokeWidth={1.8} />,
  meal:     <UtensilsCrossed size={16} strokeWidth={1.8} />,
  break:    <Coffee size={16} strokeWidth={1.8} />,
  activity: <Target size={16} strokeWidth={1.8} />,
  ceremony: <Award size={16} strokeWidth={1.8} />,
};
// (SESSION_ICON kept for potential future use)
void SESSION_ICON;

function fmtTime(iso: string) {
  const m = iso.match(/T?(\d{1,2}):(\d{2})/);
  if (!m) return iso;
  const h = parseInt(m[1], 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m[2]} ${ampm}`;
}

function isToday(iso: string) {
  const d = new Date(iso);
  const t = new Date();
  return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/* ── Today's Highlights (horizontal scroll strip) ───────────── */
function TodaysHighlights({ sessions }: { sessions: ScheduleSession[] }) {
  const today = new Date();
  const items = sessions.filter(s => {
    const d = new Date(s.start_time);
    return d.getFullYear() === today.getFullYear() &&
           d.getMonth()    === today.getMonth()    &&
           d.getDate()     === today.getDate();
  }).slice(0, 6);
  if (!items.length) return null;

  return (
    <div className="mt-4 pt-3.5 border-t border-white/10">
      <p className="text-[9px] font-bold uppercase tracking-[0.18em] mb-2.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
        Today&apos;s Highlights
      </p>
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4" style={{ scrollbarWidth: 'none' }}>
        {items.map(s => {
          const isNow = new Date(s.start_time).getTime() <= Date.now() &&
            (!s.end_time || new Date(s.end_time).getTime() > Date.now());
          return (
            <Link
              key={s.id}
              href="/schedule"
              className="flex items-center gap-2 px-3 py-2 rounded-2xl shrink-0 border transition-all active:scale-95"
              style={{
                background:   isNow ? 'rgba(255,122,0,0.16)' : 'rgba(255,255,255,0.07)',
                borderColor:  isNow ? 'rgba(255,122,0,0.40)' : 'rgba(255,255,255,0.09)',
              }}
            >
              <span className="text-base leading-none">{SESSION_EMOJI[s.type] ?? '📌'}</span>
              <div>
                <p className="text-white text-[11px] font-semibold whitespace-nowrap">{s.title}</p>
                <p className="text-[10px] font-medium mt-0.5"
                  style={{ color: isNow ? '#fb923c' : 'rgba(255,255,255,0.38)' }}>
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

/* ── Up Next card ───────────────────────────────────────────── */
function UpNext({ sessions }: { sessions: ScheduleSession[] }) {
  const now = Date.now();
  const ongoing  = sessions.find(s => new Date(s.start_time).getTime() <= now && s.end_time && new Date(s.end_time).getTime() > now);
  const upcoming = sessions.find(s => new Date(s.start_time).getTime() > now);
  const item = ongoing ?? upcoming;
  if (!item) return null;

  const isOngoing = !!ongoing;
  const diffMin   = Math.round((new Date(item.start_time).getTime() - now) / 60000);

  // Status text for the time row (no tag inside the card header)
  const notToday = !isToday(item.start_time);
  const statusText = isOngoing
    ? 'Happening now'
    : diffMin > 0 && diffMin < 60
    ? `Starts in ${diffMin} min`
    : notToday
    ? `${fmtDate(item.start_time)}, ${fmtTime(item.start_time)}`
    : fmtTime(item.start_time);

  return (
    <div className="mb-5">
      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400 mb-2.5 px-0.5">Up Next</p>
      <Link href="/schedule" className="block active:scale-[0.98] transition-transform">
        <div className="rounded-[20px] overflow-hidden bg-white shadow-[0_2px_16px_rgba(0,0,0,0.10)]">
          {/* Gradient header — no redundant tag */}
          <div
            className="relative px-4 py-4 overflow-hidden"
            style={{ background: 'linear-gradient(135deg,#1E3A8A 0%,#2563EB 60%,#60A5FA 100%)' }}
          >
            <div className="absolute inset-0 pointer-events-none"
              style={{ background: 'radial-gradient(ellipse at 85% 15%,rgba(255,255,255,0.14),transparent 55%)' }} />
            <p className="text-white font-black text-[18px] leading-snug tracking-tight relative z-10">
              {item.title}
            </p>
          </div>

          {/* Meta row */}
          <div className="px-4 py-3 flex items-center gap-4 bg-white">
            <span className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
              <Clock size={12} strokeWidth={1.8} className="text-orange-400 shrink-0" />
              {statusText}
            </span>
            {item.location && (
              <span className="flex items-center gap-1.5 text-xs text-slate-500 font-medium min-w-0">
                <MapPin size={12} strokeWidth={1.8} className="text-blue-500 shrink-0" />
                <span className="truncate">{item.location}</span>
              </span>
            )}
          </div>
        </div>
      </Link>
    </div>
  );
}

/* ── Explore tiles ──────────────────────────────────────────── */
interface Tile {
  href: string; icon: React.ReactNode; label: string; desc: string;
  gradient: string; liveKey?: 'voting' | 'qna';
  show: (v: VotingState) => boolean;
}

const TILES: Tile[] = [
  { href:'/schedule',    icon:<CalendarDays size={22} strokeWidth={1.7}/>, label:'Schedule',  desc:'Full day agenda',
    gradient:'linear-gradient(140deg,#1E3A8A,#2563EB 55%,#3B82F6)',    show:()=>true },
  { href:'/awards',      icon:<Trophy       size={22} strokeWidth={1.7}/>, label:'Awards',    desc:'Categories & winners',
    gradient:'linear-gradient(140deg,#78350F,#B45309 55%,#D97706)',    show:()=>true },
  { href:'/gallery',     icon:<ImageIcon    size={22} strokeWidth={1.7}/>, label:'Gallery',   desc:'Event photos',
    gradient:'linear-gradient(140deg,#4C1D95,#7C3AED 55%,#A78BFA)',   show:()=>true },
  { href:'/vote',        icon:<Vote         size={22} strokeWidth={1.7}/>, label:'Most Popular',      desc:'Cast your vote',
    gradient:'linear-gradient(140deg,#9A3412,#EA580C 55%,#FB923C)',    liveKey:'voting', show:v=>v==='live'||v==='paused' },
  { href:'/qna',         icon:<MessageSquare size={22} strokeWidth={1.7}/>, label:'Q&A',     desc:'Live questions',
    gradient:'linear-gradient(140deg,#064E3B,#059669 55%,#34D399)',    liveKey:'qna',    show:()=>true },
  { href:'/leaderboard', icon:<BarChart3    size={22} strokeWidth={1.7}/>, label:'Rankings',  desc:'Top participants',
    gradient:'linear-gradient(140deg,#831843,#DB2777 55%,#F472B6)',    show:()=>true },
  { href:'/me',          icon:<QrCode       size={22} strokeWidth={1.7}/>, label:'My Badge',  desc:'QR check-in',
    gradient:'linear-gradient(140deg,#0C4A6E,#0284C7 55%,#38BDF8)',   show:()=>true },
  { href:'/info',        icon:<MapPin       size={22} strokeWidth={1.7}/>, label:'Venue',     desc:'Maps & event info',
    gradient:'linear-gradient(140deg,#134E4A,#0F766E 55%,#2DD4BF)',   show:()=>true },
  { href:'/feedback',    icon:<Star         size={22} strokeWidth={1.7}/>, label:'Feedback',  desc:'Rate the event',
    gradient:'linear-gradient(140deg,#4C0519,#9F1239 55%,#F43F5E)',   show:()=>true },
];

function LivePill() {
  return (
    <span
      className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-bold text-white"
      style={{ background: '#EF4444', boxShadow: '0 2px 8px rgba(239,68,68,0.45)' }}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
      LIVE
    </span>
  );
}

/* ── Main ─────────────────────────────────────────────────── */
export default function DashboardClient({
  eventName, schedule, votingState, isCheckedIn, liveQa,
  moduleVisibility: initVisibility, moduleEnabled: initEnabled,
  eventCountdownDate,
}: Props) {
  const firstSession = schedule[0];
  const eventDate = eventCountdownDate
    ? new Date(eventCountdownDate)
    : firstSession
      ? new Date(firstSession.start_time)
      : new Date(Date.now() + 7 * 86400000);

  const anyLive    = votingState === 'live' || !!liveQa;
  const liveModules = { voting: votingState === 'live', qna: !!liveQa };

  // Poll module config every 10 s so admin changes reflect instantly
  const { data: liveConfig } = useSWR<{
    visibility: Record<string,boolean>; enabled: Record<string,boolean>; order?: string[]
  }>('/api/app-config', fetcher, {
    refreshInterval: 10000,
    fallbackData: { visibility: initVisibility ?? {}, enabled: initEnabled ?? {} },
  });
  const moduleVisibility = liveConfig?.visibility ?? initVisibility ?? {};
  const moduleEnabled    = liveConfig?.enabled    ?? initEnabled    ?? {};

  // Dynamic event progress
  const eventProgress = (() => {
    if (!schedule.length) return 0;
    const now    = Date.now();
    const sorted = [...schedule].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
    const start  = new Date(sorted[0].start_time).getTime();
    const end    = new Date(sorted[sorted.length - 1].end_time ?? sorted[sorted.length - 1].start_time).getTime();
    if (now <= start) return 0;
    if (now >= end)   return 100;
    return Math.round(((now - start) / (end - start)) * 100);
  })();

  // Tile visibility + order
  const HREF_TO_KEY: Record<string, string> = {
    '/schedule':'schedule', '/awards':'awards', '/gallery':'gallery',
    '/vote':'vote', '/qna':'qna', '/leaderboard':'leaderboard',
    '/me':'badge', '/info':'venue', '/feedback':'feedback',
  };
  const moduleOrder = liveConfig?.order;
  const visible = TILES
    .filter(t => {
      const key = HREF_TO_KEY[t.href];
      // Admin explicitly hid it → always hide
      if (key && moduleVisibility[key] === false) return false;
      // Admin explicitly set visible (or default) → show; only apply auto-show gate
      // when the module has NO explicit admin visibility stored (i.e. key absent from config)
      return true;
    })
    .sort((a, b) => {
      if (!moduleOrder) return 0;
      const ai = moduleOrder.indexOf(HREF_TO_KEY[a.href] ?? '');
      const bi = moduleOrder.indexOf(HREF_TO_KEY[b.href] ?? '');
      if (ai === -1 && bi === -1) return 0;
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });

  return (
    <div className="pb-28">

      {/* ── HERO ────────────────────────────────────────────── */}
      <div
        className="rounded-[24px] overflow-hidden relative mb-5"
        style={{ background: 'linear-gradient(150deg,#050314 0%,#0F1035 28%,#1E1B4B 60%,#080D2A 100%)' }}
      >
        {/* Ambient glows */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute w-72 h-72 rounded-full blur-3xl"
            style={{ background: 'radial-gradient(circle,rgba(107,78,255,0.26),transparent)', top:'-25%', right:'-12%' }} />
          <div className="absolute w-56 h-56 rounded-full blur-3xl"
            style={{ background: 'radial-gradient(circle,rgba(255,122,0,0.20),transparent)', bottom:'-5%', left:'-8%' }} />
        </div>
        <div className="pointer-events-none absolute inset-0"
          style={{ background: 'linear-gradient(130deg,rgba(255,255,255,0.03) 0%,transparent 40%)' }} />

        {/* Sparkle dots */}
        {([
          { top:'10%', left:'9%',  d:0 },   { top:'18%', right:'16%', d:0.7 },
          { top:'50%', right:'7%', d:1.3 }, { top:'72%', right:'22%', d:1.8 },
        ] as {top:string; left?:string; right?:string; d:number}[]).map((p, i) => (
          <motion.div
            key={i}
            className="absolute w-[3px] h-[3px] rounded-full bg-white pointer-events-none"
            style={{ top: p.top, left: p.left, right: p.right }}
            animate={{ opacity:[0.12,0.75,0.12], scale:[0.8,1.4,0.8] }}
            transition={{ repeat: Infinity, duration: 2.8, delay: p.d }}
          />
        ))}

        <div className="relative px-4 pt-5 pb-0">
          {/* LIVE badge */}
          {anyLive && (
            <Link
              href="/live"
              className="absolute top-5 right-4 flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-full z-10"
              style={{ background: '#EF4444', color: 'white', boxShadow: '0 0 14px rgba(239,68,68,0.45)' }}
            >
              <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
              LIVE NOW
            </Link>
          )}

          {/* Event name */}
          <p className="text-[9px] font-bold uppercase tracking-[0.20em] mb-1"
            style={{ color: 'rgba(251,146,60,0.65)' }}>
            {eventName}
          </p>
          <p className="text-[11px] font-semibold uppercase tracking-[2px]"
            style={{ color: 'rgba(255,255,255,0.28)' }}>
            Celebrate · Compete · Connect
          </p>

          {/* Countdown */}
          <Countdown target={eventDate} />

          {/* Progress bar */}
          <div className="mt-5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[9px] font-bold uppercase tracking-[0.15em]"
                style={{ color: 'rgba(255,255,255,0.35)' }}>
                Event Progress
              </span>
              <span className="text-[11px] font-black" style={{ color: '#FFD580' }}>{eventProgress}%</span>
            </div>
            {/* Track is explicitly visible at 20% opacity */}
            <div className="h-[5px] rounded-full" style={{ background: 'rgba(255,255,255,0.20)' }}>
              <motion.div
                className="h-full rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${eventProgress}%` }}
                transition={{ duration: 1.4, ease: 'easeOut' }}
                style={{
                  background: 'linear-gradient(90deg,#FF7A00,#FF4F87,#FFD580)',
                  boxShadow:  '0 0 10px rgba(255,122,0,0.45)',
                }}
              />
            </div>
          </div>

          {/* Today's highlights */}
          <TodaysHighlights sessions={schedule} />
        </div>

      </div>

      {/* ── CHECK-IN CTA (below hero, always visible) ─────────── */}
      {isCheckedIn ? (
        <Link
          href="/me"
          className="flex items-center gap-3 w-full px-4 py-3.5 rounded-[18px] mb-5 active:scale-[0.98] transition-transform"
          style={{ background: '#DCFCE7', border: '1px solid #BBF7D0' }}
        >
          <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
            style={{ background: '#16A34A' }}>
            <CheckCircle2 size={18} strokeWidth={2.2} color="white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-green-800 leading-tight">Already Checked In</p>
            <p className="text-[11px] text-green-600 mt-0.5">Tap to view your event pass</p>
          </div>
          <QrCode size={16} strokeWidth={1.8} className="text-green-600 shrink-0" />
        </Link>
      ) : (
        <Link
          href="/me"
          className="flex items-center justify-center gap-2.5 w-full py-[15px] rounded-[18px] mb-5 relative overflow-hidden active:scale-[0.98] transition-transform"
          style={{
            background: 'linear-gradient(135deg,#FF7A00 0%,#FF4F87 60%,#6B4EFF 100%)',
            boxShadow:  '0 6px 24px rgba(255,122,0,0.40)',
          }}
        >
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: 'linear-gradient(135deg,rgba(255,255,255,0.14) 0%,transparent 55%)' }} />
          <MapPin size={18} strokeWidth={2} color="white" />
          <span className="text-white font-black text-[15px] tracking-tight relative z-10">
            Check In
          </span>
          <span className="text-white/60 text-[11px] font-medium relative z-10">· tap to mark attendance</span>
        </Link>
      )}

      {/* ── UP NEXT ─────────────────────────────────────────── */}
      {schedule.length > 0 && <UpNext sessions={schedule} />}

      {/* ── EXPLORE ─────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3 px-0.5">
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Explore</p>
          <Link
            href="/schedule"
            className="flex items-center gap-0.5 text-[11px] font-bold"
            style={{ color: '#FF7A00' }}
          >
            See all <ChevronRight size={12} strokeWidth={2.5} />
          </Link>
        </div>

        {/* 2-column grid — pb ensures nothing clips under bottom nav */}
        <div className="grid grid-cols-2 gap-3">
          {visible.map(tile => {
            const isLive     = tile.liveKey ? liveModules[tile.liveKey] : false;
            const key        = HREF_TO_KEY[tile.href];
            const isDisabled = !!(key && moduleEnabled && moduleEnabled[key] === false);

            return (
              <Link
                key={tile.href}
                href={isDisabled ? '#' : tile.href}
                onClick={isDisabled ? e => e.preventDefault() : undefined}
                className={`rounded-[20px] overflow-hidden flex flex-col justify-between p-4 relative transition-transform ${
                  isDisabled ? 'opacity-50 cursor-not-allowed' : 'active:scale-[0.96]'
                }`}
                style={{
                  background: isDisabled ? '#94A3B8' : tile.gradient,
                  minHeight:  148,
                }}
              >
                {/* Shine */}
                <div className="absolute inset-0 pointer-events-none"
                  style={{ background: 'linear-gradient(135deg,rgba(255,255,255,0.12) 0%,transparent 50%)' }} />

                {/* Top row: icon + arrow/badge */}
                <div className="flex items-start justify-between relative z-10">
                  <div
                    className="w-11 h-11 rounded-[12px] flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(255,255,255,0.18)' }}
                  >
                    <span style={{ color: 'white' }}>{tile.icon}</span>
                  </div>

                  {isDisabled ? (
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-lg bg-black/30 text-white/80 uppercase tracking-wider">
                      Disabled
                    </span>
                  ) : isLive ? (
                    <LivePill />
                  ) : (
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center"
                      style={{ background: 'rgba(255,255,255,0.15)' }}
                    >
                      <ChevronRight size={13} strokeWidth={2.2} color="white" />
                    </div>
                  )}
                </div>

                {/* Bottom: label + desc */}
                <div className="relative z-10 mt-2">
                  <p className="font-black text-white text-[15px] leading-tight">{tile.label}</p>
                  <p className="text-[11px] mt-0.5 leading-snug font-medium"
                    style={{ color: 'rgba(255,255,255,0.72)' }}>
                    {tile.desc}
                  </p>
                  {isLive && (
                    <span
                      className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-[7px]"
                      style={{ background: 'rgba(255,255,255,0.18)', color: 'white' }}
                    >
                      <Zap size={9} strokeWidth={2.5} />Live Now
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
