'use client';

import useSWR from 'swr';
import { useRealtime } from './useRealtime';
import type { ScheduleSession } from '@/lib/types';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const TYPE_COLORS: Record<string, string> = {
  session: 'border-brand-400 bg-brand-50',
  meal: 'border-amber-400 bg-amber-50',
  break: 'border-green-400 bg-green-50',
  activity: 'border-purple-400 bg-purple-50',
  ceremony: 'border-rose-400 bg-rose-50',
};

const TYPE_ICONS: Record<string, string> = {
  session: '🎤',
  meal: '🍽️',
  break: '☕',
  activity: '🎯',
  ceremony: '🏆',
};

function fmtTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
  } catch {
    return iso;
  }
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
  const { data, mutate } = useSWR('/api/schedule', fetcher, {
    fallbackData: { sessions: initial },
    refreshInterval: 30000,
  });
  useRealtime(['/api/schedule']);

  const sessions: ScheduleSession[] = data?.sessions ?? initial;
  const groups = groupByDay(sessions);

  if (!sessions.length) {
    return (
      <div className="text-center py-16 text-slate-400">
        <p className="text-4xl mb-3">📅</p>
        <p className="font-semibold">Schedule not published yet</p>
        <p className="text-sm mt-1">Check back soon!</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {groups.map(([day, items]) => (
        <section key={day}>
          <h2 className="text-sm font-extrabold text-slate-500 uppercase tracking-wider mb-3 sticky top-14 bg-slate-50 py-1">
            {fmtDate(items[0].start_time)}
          </h2>
          <ol className="relative border-l-2 border-slate-200 space-y-4 ml-3">
            {items.map((s: ScheduleSession) => {
              const now = isNow(s);
              const color = TYPE_COLORS[s.type] ?? TYPE_COLORS.session;
              return (
                <li key={s.id} className="ml-4 relative">
                  <span
                    className={`absolute -left-[1.375rem] top-3 w-3.5 h-3.5 rounded-full border-2 border-white ${
                      now ? 'bg-green-500 ring-2 ring-green-300 animate-pulse' : 'bg-slate-300'
                    }`}
                  />
                  <div className={`rounded-xl border-l-4 px-4 py-3 ${color} ${now ? 'shadow-md' : ''}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 flex items-center gap-1.5">
                          <span>{TYPE_ICONS[s.type]}</span>
                          <span className="truncate">{s.title}</span>
                          {now && (
                            <span className="ml-1 text-xs bg-green-500 text-white px-1.5 py-0.5 rounded-full font-semibold shrink-0">
                              Now
                            </span>
                          )}
                        </p>
                        {s.speaker && (
                          <p className="text-xs text-slate-500 mt-0.5">👤 {s.speaker}</p>
                        )}
                        {s.location && (
                          <p className="text-xs text-slate-500 mt-0.5">📍 {s.location}</p>
                        )}
                        {s.description && (
                          <p className="text-xs text-slate-600 mt-1 whitespace-pre-line">{s.description}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-semibold text-slate-600">{fmtTime(s.start_time)}</p>
                        {s.end_time && (
                          <p className="text-xs text-slate-400">– {fmtTime(s.end_time)}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
