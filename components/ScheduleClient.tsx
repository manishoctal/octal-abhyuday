'use client';

import { useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import { useRealtime } from './useRealtime';
import type { ScheduleSession } from '@/lib/types';

const fetcher = (url: string) => fetch(url).then(r => r.json());

const TYPE_DOT: Record<string, string> = {
  session:  '#FE9234',
  meal:     '#F59E0B',
  break:    '#10B981',
  activity: '#8B5CF6',
  ceremony: '#EF4444',
};
const TYPE_ICON: Record<string, string> = {
  session: '🎤', meal: '🍽️', break: '☕', activity: '🎯', ceremony: '🏆',
};
const TYPE_BG: Record<string, string> = {
  session:  '#FFF4E8',
  meal:     '#FFFBEB',
  break:    '#ECFDF5',
  activity: '#F5F3FF',
  ceremony: '#FFF1F2',
};

function fmtTime(iso: string) {
  const m = iso.match(/T?(\d{1,2}):(\d{2})/);
  if (!m) return iso;
  const h = parseInt(m[1], 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m[2]} ${ampm}`;
}
function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' }); }
  catch { return iso; }
}
function isNow(s: ScheduleSession) {
  const now = Date.now();
  const start = new Date(s.start_time).getTime();
  const end = s.end_time ? new Date(s.end_time).getTime() : start + 3600000;
  return now >= start && now < end;
}
function groupByDay(sessions: ScheduleSession[]) {
  const map = new Map<string, ScheduleSession[]>();
  for (const s of sessions) {
    const day = s.start_time.slice(0, 10);
    if (!map.has(day)) map.set(day, []);
    map.get(day)!.push(s);
  }
  return Array.from(map.entries());
}

export default function ScheduleClient({ initial }: { initial: ScheduleSession[] }) {
  const { data } = useSWR('/api/schedule', fetcher, {
    fallbackData: { sessions: initial },
    refreshInterval: 30000,
  });
  useRealtime(['/api/schedule']);

  // Refresh "now" every minute so live indicator stays accurate
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const liveRef = useRef<HTMLDivElement | null>(null);
  const scrolledRef = useRef(false);

  const sessions: ScheduleSession[] = data?.sessions ?? initial;
  const groups = groupByDay(sessions);

  // Auto-scroll to the live session once on mount (after sessions load)
  useEffect(() => {
    if (scrolledRef.current || !sessions.length) return;
    const live = sessions.find(s => isNow(s));
    if (!live) return;
    scrolledRef.current = true;
    setTimeout(() => liveRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions.length]);

  return (
    <div className="space-y-8 pb-4">{!sessions.length ? (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-16 h-16 rounded-3xl bg-slate-100 flex items-center justify-center text-3xl mb-4">
          <span>&#128197;</span>
        </div>
        <p className="font-semibold text-slate-700">Schedule not published yet</p>
        <p className="text-sm text-slate-400 mt-1">Check back soon</p>
      </div>
    ) : null}
      {groups.map(([day, items]) => (
        <section key={day}>
          {/* Day label */}
          <div className="sticky top-14 bg-[#F8FAFC] py-2 z-10">
            <p className="section-title">{fmtDate(items[0].start_time)}</p>
          </div>

          {/* Sessions */}
          <div className="space-y-3">
            {items.map((s: ScheduleSession) => {
              const live = isNow(s);
              const dotColor = TYPE_DOT[s.type] ?? TYPE_DOT.session;
              const iconBg = TYPE_BG[s.type] ?? TYPE_BG.session;

              return (
                <div
                  key={s.id}
                  ref={live ? liveRef : undefined}
                  className="card px-4 py-4 overflow-hidden transition-all"
                  style={live ? {
                    borderLeft: `3px solid ${dotColor}`,
                    background: `linear-gradient(to right, ${dotColor}0f, white 40%)`,
                    boxShadow: `0 0 0 1px ${dotColor}30, 0 4px 16px ${dotColor}20`,
                  } : {}}
                >
                  {/* Time row */}
                  <div className="flex items-center gap-2 mb-2.5">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${live ? 'animate-pulse' : ''}`}
                      style={{ background: dotColor, boxShadow: live ? `0 0 0 3px ${dotColor}30` : 'none' }}
                    />
                    <span className="text-sm font-bold text-slate-700">{fmtTime(s.start_time)}</span>
                    {s.end_time && (
                      <span className="text-xs text-slate-400">→ {fmtTime(s.end_time)}</span>
                    )}
                    {live && (
                      <span
                        className="ml-auto text-[11px] font-black px-2.5 py-0.5 rounded-full shrink-0 animate-pulse"
                        style={{ background: dotColor, color: 'white', letterSpacing: '0.04em' }}
                      >
                        LIVE NOW
                      </span>
                    )}
                  </div>

                  {/* Content row */}
                  <div className="flex items-start gap-3">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0"
                      style={{ background: iconBg }}
                    >
                      {TYPE_ICON[s.type]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-[16px] leading-snug text-slate-900">{s.title}</p>
                      {s.speaker && <p className="text-sm text-slate-500 mt-1">🎙 {s.speaker}</p>}
                      {s.location && <p className="text-sm text-slate-500 mt-1">📍 {s.location}</p>}
                      {s.description && (
                        <p className="text-sm text-slate-500 mt-1.5 leading-relaxed whitespace-pre-line">{s.description}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
