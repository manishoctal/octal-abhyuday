'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useRealtime } from './useRealtime';
import type { EventInfoItem } from '@/lib/types';

const fetcher = (url: string) => fetch(url).then(r => r.json());

const SECTION_ICON: Record<string, string> = {
  venue: '📍', parking: '🅿️', contacts: '📞', faq: '❓', instructions: '📋', schedule: '📅',
};

/** Convert any Google Maps share URL into an embeddable iframe src. */
function toEmbedUrl(url: string): string {
  // Already an embed URL
  if (url.includes('maps/embed')) return url;
  // Short link (goo.gl/maps/…) — can't convert reliably client-side; use place search fallback
  if (url.includes('goo.gl')) {
    // We embed the original URL inside a place search — works for most cases
    return `https://maps.google.com/maps?q=${encodeURIComponent(url)}&output=embed`;
  }
  // Long URL with @lat,lng — convert to embed
  const coordMatch = url.match(/@(-?[\d.]+),(-?[\d.]+)/);
  if (coordMatch) {
    return `https://maps.google.com/maps?q=${coordMatch[1]},${coordMatch[2]}&output=embed&z=16`;
  }
  // Place name / query URL
  const qMatch = url.match(/[?&]q=([^&]+)/);
  if (qMatch) {
    return `https://maps.google.com/maps?q=${qMatch[1]}&output=embed`;
  }
  // Fallback: wrap whatever we have
  return `https://maps.google.com/maps?q=${encodeURIComponent(url)}&output=embed`;
}

function groupBySection(items: EventInfoItem[]) {
  const map = new Map<string, EventInfoItem[]>();
  for (const i of items) {
    if (!map.has(i.section)) map.set(i.section, []);
    map.get(i.section)!.push(i);
  }
  return Array.from(map.entries());
}

/** Venue / parking item — shows map embed + Get Directions if maps_url is set */
function VenueItem({ item }: { item: EventInfoItem }) {
  const [open, setOpen] = useState(false);
  const hasMap = !!item.maps_url;

  return (
    <div className="border-b border-slate-100 last:border-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between py-3.5 text-left gap-3"
      >
        <span className="font-medium text-slate-800 text-[14px] flex-1">{item.title}</span>
        <svg
          width="16" height="16" viewBox="0 0 16 16" fill="none"
          className={`shrink-0 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        >
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <div className="pb-4 space-y-3">
          {/* Body text */}
          <p className="text-sm text-slate-500 leading-relaxed whitespace-pre-line">{item.body}</p>

          {hasMap && (
            <>
              {/* Map embed */}
              <div className="rounded-2xl overflow-hidden border border-slate-100" style={{ height: 200 }}>
                <iframe
                  src={toEmbedUrl(item.maps_url!)}
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title={item.title}
                />
              </div>

              {/* Action buttons */}
              <div className="flex gap-2">
                <a
                  href={item.maps_url!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 h-11 rounded-2xl text-sm font-semibold text-white active:scale-95 transition-transform"
                  style={{ background: '#FE9234' }}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M8 1.5C5.5 1.5 3.5 3.5 3.5 6c0 3.5 4.5 8.5 4.5 8.5S12.5 9.5 12.5 6c0-2.5-2-4.5-4.5-4.5z" stroke="white" strokeWidth="1.3" fill="none"/>
                    <circle cx="8" cy="6" r="1.5" fill="white"/>
                  </svg>
                  Get Directions
                </a>
                <a
                  href={`https://maps.google.com/maps?q=${encodeURIComponent(item.title)}&dirflg=d`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 h-11 px-4 rounded-2xl text-sm font-semibold border border-slate-200 bg-white text-slate-700 active:scale-95 transition-transform"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M7 1v8M4 6l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M2 11h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  Navigate
                </a>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** Generic accordion for non-venue sections */
function AccordionItem({ item }: { item: EventInfoItem }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-slate-100 last:border-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between py-3.5 text-left gap-3"
      >
        <span className="font-medium text-slate-800 text-[14px] flex-1">{item.title}</span>
        <svg
          width="16" height="16" viewBox="0 0 16 16" fill="none"
          className={`shrink-0 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        >
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {open && (
        <div className="pb-3.5 text-sm text-slate-500 leading-relaxed whitespace-pre-line">
          {item.body}
        </div>
      )}
    </div>
  );
}

const VENUE_SECTIONS = new Set(['venue', 'parking']);

export default function InfoClient({ initial }: { initial: EventInfoItem[] }) {
  const { data } = useSWR('/api/info', fetcher, {
    fallbackData: { items: initial },
    refreshInterval: 60000,
  });
  useRealtime(['/api/info']);

  const items: EventInfoItem[] = data?.items ?? initial;
  const groups = groupBySection(items);

  return (
    <div className="space-y-4 pb-4">
      {groups.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-3xl bg-slate-100 flex items-center justify-center text-3xl mb-4">ℹ️</div>
          <p className="font-semibold text-slate-700">Information coming soon</p>
          <p className="text-sm text-slate-400 mt-1">Event details will appear here</p>
        </div>
      )}

      {groups.map(([section, sItems]) => {
        const icon = SECTION_ICON[section.toLowerCase()] ?? 'ℹ️';
        const title = section.charAt(0).toUpperCase() + section.slice(1);
        const isVenue = VENUE_SECTIONS.has(section.toLowerCase());
        return (
          <div key={section} className="card overflow-hidden">
            {/* Section header */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center text-base shrink-0"
                style={{ background: '#FFF4E8' }}
              >
                {icon}
              </div>
              <p className="font-semibold text-slate-900 text-[14px]">{title}</p>
            </div>
            {/* Items */}
            <div className="px-4">
              {sItems.map(item =>
                isVenue
                  ? <VenueItem key={item.id} item={item} />
                  : <AccordionItem key={item.id} item={item} />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
