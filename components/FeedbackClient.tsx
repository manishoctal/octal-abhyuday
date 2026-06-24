'use client';

import { useState } from 'react';
import type { FeedbackRow } from '@/lib/db';
import type { ScheduleSession } from '@/lib/types';

interface Props {
  existing: FeedbackRow | null;
  sessions: ScheduleSession[];
}

function StarRating({ value, onChange, label }: { value: number; onChange: (v: number) => void; label?: string }) {
  const [hover, setHover] = useState(0);
  return (
    <div>
      {label && <p className="text-sm text-slate-500 mb-2">{label}</p>}
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            type="button"
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => onChange(n)}
            className="w-10 h-10 flex items-center justify-center rounded-xl transition-all active:scale-90"
            style={{ background: n <= (hover || value) ? '#FFF4E8' : 'transparent' }}
          >
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <path
                d="M11 2l2.472 5.236 5.528.824-4 4.05.944 5.526L11 14.948l-4.944 2.688.944-5.526-4-4.05 5.528-.824L11 2z"
                fill={n <= (hover || value) ? '#FE9234' : 'none'}
                stroke={n <= (hover || value) ? '#FE9234' : '#CBD5E1'}
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function FeedbackClient({ existing, sessions }: Props) {
  const parsed = existing?.session_ratings ? JSON.parse(existing.session_ratings) : {};

  const [overall, setOverall] = useState(existing?.overall_rating ?? 0);
  const [food, setFood] = useState(existing?.food_rating ?? 0);
  const [venue, setVenue] = useState(existing?.venue_rating ?? 0);
  const [sessionRatings, setSessionRatings] = useState<Record<string, number>>(parsed);
  const [suggestions, setSuggestions] = useState(existing?.suggestions ?? '');
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!overall) return alert('Please rate your overall experience');
    setSubmitting(true);
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          overall_rating: overall,
          session_ratings: sessionRatings,
          food_rating: food || null,
          venue_rating: venue || null,
          suggestions: suggestions || null,
        }),
      });
      if (res.ok) setSaved(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (saved) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center px-4">
        <div
          className="w-16 h-16 rounded-3xl flex items-center justify-center text-2xl mb-5"
          style={{ background: '#FFF4E8' }}
        >
          🙏
        </div>
        <h2 className="font-bold text-slate-900 text-xl">Thank you!</h2>
        <p className="text-slate-400 text-sm mt-2 max-w-xs leading-relaxed">
          Your feedback has been recorded. You can update it anytime before the event ends.
        </p>
        <button
          onClick={() => setSaved(false)}
          className="mt-6 text-sm font-semibold"
          style={{ color: '#FE9234' }}
        >
          Edit my feedback →
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 pb-4">

      {existing && (
        <div
          className="flex items-center gap-2 px-4 py-3 rounded-2xl text-sm font-medium"
          style={{ background: '#FFF4E8', color: '#C85F10' }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 1v6M7 10v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          Editing your existing response — changes will be saved.
        </div>
      )}

      {/* Overall */}
      <div className="card px-5 py-4 space-y-3">
        <p className="font-semibold text-slate-900">Overall Experience</p>
        <StarRating value={overall} onChange={setOverall} />
      </div>

      {/* Venue & food */}
      <div className="card px-5 py-4 space-y-4">
        <p className="font-semibold text-slate-900">Venue & Food</p>
        <StarRating value={food}  onChange={setFood}  label="Food quality" />
        <div className="h-px bg-slate-100" />
        <StarRating value={venue} onChange={setVenue} label="Venue & facilities" />
      </div>

      {/* Sessions */}
      {sessions.length > 0 && (
        <div className="card px-5 py-4 space-y-4">
          <p className="font-semibold text-slate-900">Sessions</p>
          {sessions.map((s, i) => (
            <div key={s.id}>
              {i > 0 && <div className="h-px bg-slate-100 mb-4" />}
              <StarRating
                value={sessionRatings[String(s.id)] ?? 0}
                onChange={v => setSessionRatings(prev => ({ ...prev, [String(s.id)]: v }))}
                label={s.title}
              />
            </div>
          ))}
        </div>
      )}

      {/* Suggestions */}
      <div className="card px-5 py-4">
        <p className="font-semibold text-slate-900 mb-3">Suggestions</p>
        <textarea
          className="input resize-none text-sm"
          rows={4}
          placeholder="Suggestions for next year, what you enjoyed most…"
          value={suggestions}
          onChange={e => setSuggestions(e.target.value)}
        />
      </div>

      <button
        type="submit"
        disabled={submitting || !overall}
        className="btn-primary"
      >
        {submitting ? 'Submitting…' : existing ? 'Update Feedback' : 'Submit Feedback'}
      </button>
    </form>
  );
}
