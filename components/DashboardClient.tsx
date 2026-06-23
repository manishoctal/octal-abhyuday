'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { ScheduleSession, VotingState, VotingRound } from '@/lib/types';

interface Props {
  eventName: string;
  schedule: ScheduleSession[];
  votingState: VotingState;
  votingRound: VotingRound;
  isCheckedIn: boolean;
  userId: number;
  userName: string;
}

const SESSION_COLORS: Record<string, string> = {
  session: 'bg-brand-50 border-brand-200 text-brand-700',
  meal: 'bg-amber-50 border-amber-200 text-amber-700',
  break: 'bg-green-50 border-green-200 text-green-700',
  activity: 'bg-purple-50 border-purple-200 text-purple-700',
  ceremony: 'bg-rose-50 border-rose-200 text-rose-700',
};

const SESSION_ICONS: Record<string, string> = {
  session: '🎤',
  meal: '🍽️',
  break: '☕',
  activity: '🎯',
  ceremony: '🏆',
};

function Countdown({ target }: { target: Date }) {
  const [diff, setDiff] = useState(() => target.getTime() - Date.now());

  useEffect(() => {
    const t = setInterval(() => setDiff(target.getTime() - Date.now()), 1000);
    return () => clearInterval(t);
  }, [target]);

  if (diff <= 0) return <span className="text-green-600 font-bold">Event is live! 🎉</span>;

  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);

  return (
    <div className="flex gap-3 justify-center">
      {[['Days', d], ['Hrs', h], ['Min', m], ['Sec', s]].map(([label, val]) => (
        <div key={String(label)} className="flex flex-col items-center">
          <span className="text-2xl sm:text-3xl font-extrabold text-white tabular-nums w-12 text-center">
            {String(val).padStart(2, '0')}
          </span>
          <span className="text-xs text-indigo-200 uppercase tracking-wide">{label}</span>
        </div>
      ))}
    </div>
  );
}

function NextUp({ sessions }: { sessions: ScheduleSession[] }) {
  const now = new Date();
  const upcoming = sessions.find((s) => new Date(s.start_time) > now);
  const ongoing = sessions.find(
    (s) => new Date(s.start_time) <= now && s.end_time && new Date(s.end_time) > now
  );
  const item = ongoing ?? upcoming;
  if (!item) return null;

  const label = ongoing ? 'Happening now' : 'Up next';
  const color = SESSION_COLORS[item.type] ?? SESSION_COLORS.session;

  return (
    <div className={`rounded-xl border px-4 py-3 ${color} flex items-start gap-3`}>
      <span className="text-2xl">{SESSION_ICONS[item.type]}</span>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide opacity-60">{label}</p>
        <p className="font-bold truncate">{item.title}</p>
        {item.location && <p className="text-xs opacity-70 mt-0.5">📍 {item.location}</p>}
      </div>
    </div>
  );
}

const MODULES = [
  {
    href: '/vote',
    icon: '🗳️',
    label: 'Vote',
    desc: 'Popularity voting',
    bg: 'bg-brand-600 text-white',
    show: (v: VotingState) => v === 'live' || v === 'paused',
  },
  {
    href: '/schedule',
    icon: '📅',
    label: 'Schedule',
    desc: 'Full event agenda',
    bg: 'bg-slate-800 text-white',
    show: () => true,
  },
  {
    href: '/qna',
    icon: '💬',
    label: 'Q&A',
    desc: 'Live questions',
    bg: 'bg-violet-600 text-white',
    show: () => true,
  },
  {
    href: '/info',
    icon: '📍',
    label: 'Venue & Info',
    desc: 'Location & FAQs',
    bg: 'bg-emerald-600 text-white',
    show: () => true,
  },
  {
    href: '/voting-results',
    icon: '🏆',
    label: 'Results',
    desc: 'Winner announcement',
    bg: 'bg-amber-500 text-white',
    show: () => true,
  },
  {
    href: '/me',
    icon: '🪪',
    label: 'My QR Code',
    desc: 'Check-in badge',
    bg: 'bg-slate-600 text-white',
    show: () => true,
  },
];

export default function DashboardClient({ eventName, schedule, votingState, isCheckedIn, userId }: Props) {
  // Derive event date from first session, fallback to a far-future date
  const firstSession = schedule[0];
  const eventDate = firstSession ? new Date(firstSession.start_time) : new Date(Date.now() + 7 * 86400000);

  const visibleModules = MODULES.filter((m) => m.show(votingState));

  return (
    <div className="space-y-5">
      {/* Hero / countdown */}
      <div className="rounded-2xl bg-gradient-to-br from-brand-600 to-violet-600 px-6 py-7 text-center shadow-lg">
        <p className="text-indigo-200 text-sm font-semibold uppercase tracking-widest mb-1">Welcome to</p>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-4">{eventName}</h1>
        <Countdown target={eventDate} />
        {isCheckedIn && (
          <p className="mt-3 text-xs text-indigo-200">
            ✅ You're checked in
          </p>
        )}
      </div>

      {/* Next up from schedule */}
      {schedule.length > 0 && <NextUp sessions={schedule} />}

      {/* Quick check-in CTA if not yet done */}
      {!isCheckedIn && (
        <Link
          href="/me"
          className="flex items-center gap-3 rounded-xl border-2 border-dashed border-brand-300 px-4 py-3 text-brand-700 hover:bg-brand-50 transition"
        >
          <span className="text-2xl">🪪</span>
          <div>
            <p className="font-bold text-sm">Check in to the event</p>
            <p className="text-xs opacity-70">Show your QR code at the entrance</p>
          </div>
          <span className="ml-auto text-brand-400">→</span>
        </Link>
      )}

      {/* Module grid */}
      <div>
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Event Features</h2>
        <div className="grid grid-cols-2 gap-3">
          {visibleModules.map((mod) => (
            <Link
              key={mod.href}
              href={mod.href}
              className={`rounded-2xl p-4 flex flex-col gap-1 shadow-sm hover:opacity-90 active:scale-95 transition-transform ${mod.bg}`}
            >
              <span className="text-2xl">{mod.icon}</span>
              <span className="font-bold text-sm leading-tight">{mod.label}</span>
              <span className="text-xs opacity-70">{mod.desc}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
