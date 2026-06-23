'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useRealtime } from './useRealtime';
import type { EventInfoItem } from '@/lib/types';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const SECTION_ICONS: Record<string, string> = {
  venue: '📍',
  parking: '🅿️',
  contacts: '📞',
  faq: '❓',
  instructions: '📋',
  schedule: '📅',
};

function groupBySection(items: EventInfoItem[]) {
  const map = new Map<string, EventInfoItem[]>();
  for (const i of items) {
    if (!map.has(i.section)) map.set(i.section, []);
    map.get(i.section)!.push(i);
  }
  return Array.from(map.entries());
}

function Accordion({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-slate-50 transition text-left"
      >
        <span className="font-semibold text-slate-800">{title}</span>
        <span className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>
      {open && <div className="px-4 pb-4 pt-1 text-sm text-slate-600 bg-white whitespace-pre-line">{children}</div>}
    </div>
  );
}

export default function InfoClient({ initial }: { initial: EventInfoItem[] }) {
  const { data, mutate } = useSWR('/api/info', fetcher, {
    fallbackData: { items: initial },
    refreshInterval: 60000,
  });
  useRealtime(['/api/info']);

  const items: EventInfoItem[] = data?.items ?? initial;
  const groups = groupBySection(items);

  return (
    <div className="space-y-6">
      {/* Venue map placeholder — admin configures via event-info */}
      {items.some((i) => i.section === 'venue') && (
        <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
          <div className="aspect-video bg-slate-100 flex items-center justify-center text-slate-400">
            <div className="text-center">
              <p className="text-3xl mb-1">🗺️</p>
              <p className="text-sm font-semibold">Venue Map</p>
              <p className="text-xs mt-1">Navigate via Google Maps →</p>
            </div>
          </div>
        </div>
      )}

      {groups.length === 0 && (
        <div className="text-center text-slate-400 py-12">
          <p className="text-4xl mb-2">ℹ️</p>
          <p className="font-semibold">Event information coming soon</p>
        </div>
      )}

      {groups.map(([section, sItems]) => {
        const icon = SECTION_ICONS[section.toLowerCase()] ?? 'ℹ️';
        return (
          <div key={section}>
            <h2 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-slate-500 mb-2">
              <span>{icon}</span>
              <span>{section.charAt(0).toUpperCase() + section.slice(1)}</span>
            </h2>
            <div className="space-y-2">
              {sItems.map((item: EventInfoItem) => (
                <Accordion key={item.id} title={item.title}>
                  {item.body}
                </Accordion>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
