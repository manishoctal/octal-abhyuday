'use client';

import { useState, useEffect, useRef } from 'react';
import useSWR from 'swr';
import { useRealtime } from './useRealtime';
import type { AwardCategory, AwardNominee } from '@/lib/db';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function AwardsClient({ initial }: { initial: AwardCategory[] }) {
  const { data } = useSWR('/api/awards', fetcher, {
    fallbackData: { categories: initial },
    refreshInterval: 15000,
  });
  useRealtime(['/api/awards']);

  const categories: AwardCategory[] = data?.categories ?? initial;
  const announced = categories.filter(c => c.winner).length;

  if (categories.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-16 h-16 rounded-3xl bg-slate-100 flex items-center justify-center text-3xl mb-4">🏅</div>
        <p className="font-semibold text-slate-700">Awards coming soon</p>
        <p className="text-sm text-slate-400 mt-1">Categories will be revealed during the ceremony</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-4">
      {/* Progress header */}
      <div className="flex items-center justify-between">
        <p className="section-title">{categories.length} categories</p>
        <span
          className="text-[11px] font-bold px-2.5 py-1 rounded-full"
          style={{ background: '#FFF4E8', color: '#FE9234' }}
        >
          {announced}/{categories.length} announced
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${(announced / categories.length) * 100}%`, background: '#FE9234' }}
        />
      </div>

      {categories.map(cat => (
        <CategoryCard key={cat.id} category={cat} />
      ))}
    </div>
  );
}

function CategoryCard({ category }: { category: AwardCategory }) {
  const [revealed, setRevealed] = useState(false);
  const confettiRef = useRef(false);
  const hasWinner = !!category.winner;

  useEffect(() => {
    if (hasWinner && !confettiRef.current && revealed) {
      confettiRef.current = true;
      import('canvas-confetti').then(m => {
        m.default({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.65 },
          colors: ['#FE9234', '#FFF4E8', '#0F172A', '#FBBF24'],
        });
      });
    }
  }, [hasWinner, revealed]);

  return (
    <div className={`card overflow-hidden ${hasWinner ? 'shadow-card-md' : ''}`}>
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-4">
        {/* Icon */}
        <div
          className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg shrink-0"
          style={{ background: hasWinner ? '#FFFBEB' : '#F8FAFC' }}
        >
          {hasWinner ? '🏆' : '🏅'}
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-900 text-[14px] leading-snug">{category.name}</p>
          {category.description && (
            <p className="text-xs text-slate-400 mt-0.5 truncate">{category.description}</p>
          )}
        </div>

        {hasWinner && (
          <span
            className="text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0"
            style={{ background: '#FFFBEB', color: '#B45309' }}
          >
            Winner
          </span>
        )}
      </div>

      {/* Winner reveal */}
      {hasWinner && (
        <div className="px-4 pb-4">
          {!revealed ? (
            <button
              onClick={() => setRevealed(true)}
              className="btn-primary h-12 text-[14px]"
            >
              Reveal Winner
            </button>
          ) : (
            <div className="flex items-center gap-4 bg-[#FFFBEB] rounded-2xl px-4 py-3.5 animate-scale-in">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg text-white shrink-0"
                style={{ background: '#FE9234' }}
              >
                {category.winner!.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="gold-text font-bold text-lg leading-tight">{category.winner!.name}</p>
                {category.winner!.department && (
                  <p className="text-xs text-slate-500 mt-0.5">{category.winner!.department}</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Nominees list */}
      {!hasWinner && category.nominees && category.nominees.length > 0 && (
        <div className="px-4 pb-4 border-t border-slate-100 pt-3">
          <p className="section-title mb-2">Nominees</p>
          <div className="flex flex-wrap gap-2">
            {category.nominees.map((n: AwardNominee) => (
              <div
                key={n.id}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-200 bg-white"
              >
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                  style={{ background: '#0F172A' }}
                >
                  {n.name.charAt(0)}
                </span>
                <span className="text-xs font-medium text-slate-700">{n.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
