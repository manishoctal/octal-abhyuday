'use client';

import type { FeedbackRow } from '@/lib/db';

type FeedbackWithUser = FeedbackRow & { name: string; email: string };

function avg(arr: number[]) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function Stars({ n }: { n: number }) {
  return <span>{Array.from({ length: 5 }, (_, i) => i < n ? '⭐' : '☆').join('')}</span>;
}

export default function AdminFeedbackModule({ initial }: { initial: FeedbackWithUser[] }) {
  const rows = initial;
  const overallAvg = avg(rows.map(r => r.overall_rating));
  const foodAvg = avg(rows.filter(r => r.food_rating != null).map(r => r.food_rating!));
  const venueAvg = avg(rows.filter(r => r.venue_rating != null).map(r => r.venue_rating!));

  function exportCsv() {
    const lines = [
      'Name,Email,Overall,Food,Venue,Suggestions,Submitted',
      ...rows.map(r =>
        `"${r.name}","${r.email}",${r.overall_rating},${r.food_rating ?? ''},${r.venue_rating ?? ''},"${(r.suggestions ?? '').replace(/"/g, '""')}","${r.submitted_at}"`
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'feedback.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Overall', val: overallAvg },
          { label: 'Food', val: foodAvg },
          { label: 'Venue', val: venueAvg },
        ].map(({ label, val }) => (
          <div key={label} className="bg-white border border-slate-200 rounded-2xl p-4 text-center shadow-sm">
            <p className="text-2xl font-extrabold text-slate-800">{val.toFixed(1)}</p>
            <p className="text-xs text-slate-400 font-semibold mt-0.5">{label}</p>
            <Stars n={Math.round(val)} />
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500 font-semibold">{rows.length} responses</p>
        <button
          onClick={exportCsv}
          className="text-xs font-bold text-brand-600 border border-brand-200 bg-brand-50 px-3 py-1.5 rounded-full hover:bg-brand-100"
        >
          ↓ Export CSV
        </button>
      </div>

      {/* Rows */}
      <div className="space-y-3">
        {rows.map(r => (
          <div key={r.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="font-bold text-slate-800 text-sm">{r.name}</p>
                <p className="text-xs text-slate-400">{r.email}</p>
              </div>
              <Stars n={r.overall_rating} />
            </div>
            <div className="flex gap-3 text-xs text-slate-500">
              {r.food_rating != null && <span>🍽️ Food: {r.food_rating}/5</span>}
              {r.venue_rating != null && <span>📍 Venue: {r.venue_rating}/5</span>}
            </div>
            {r.suggestions && (
              <p className="text-sm text-slate-600 mt-2 bg-slate-50 rounded-xl px-3 py-2">
                &ldquo;{r.suggestions}&rdquo;
              </p>
            )}
          </div>
        ))}
      </div>

      {rows.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <span className="text-5xl mb-3">⭐</span>
          <p className="font-bold">No feedback yet</p>
        </div>
      )}
    </div>
  );
}
