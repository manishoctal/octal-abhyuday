'use client';

import { useState } from 'react';
import type { FeedbackQuestion, FeedbackSubmission } from '@/lib/db';

interface Props {
  questions:  FeedbackQuestion[];
  existing:   FeedbackSubmission | null;
}

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1.5">
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button"
          onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)}
          onClick={() => onChange(value === n ? 0 : n)}
          className="w-11 h-11 flex items-center justify-center rounded-xl transition-all active:scale-90"
          style={{ background: n <= (hover || value) ? '#FFF4E8' : 'transparent' }}
        >
          <svg width="24" height="24" viewBox="0 0 22 22" fill="none">
            <path d="M11 2l2.472 5.236 5.528.824-4 4.05.944 5.526L11 14.948l-4.944 2.688.944-5.526-4-4.05 5.528-.824L11 2z"
              fill={n <= (hover || value) ? '#FE9234' : 'none'}
              stroke={n <= (hover || value) ? '#FE9234' : '#CBD5E1'}
              strokeWidth="1.5" strokeLinejoin="round" />
          </svg>
        </button>
      ))}
    </div>
  );
}

export default function FeedbackClient({ questions, existing }: Props) {
  const initial = existing?.answers ? (JSON.parse(existing.answers) as Record<string, unknown>) : {};
  const [answers, setAnswers]     = useState<Record<string, unknown>>(initial);
  const [saved, setSaved]         = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]         = useState('');

  function set(id: number, value: unknown) {
    setAnswers(prev => ({ ...prev, [String(id)]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const missing = questions.filter(q => q.active && q.required && !answers[String(q.id)]);
    if (missing.length) {
      setError(`Please answer: ${missing.map(q => q.title).join(', ')}`);
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      });
      if (res.ok) setSaved(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (saved) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center px-4">
        <div className="w-16 h-16 rounded-3xl flex items-center justify-center text-3xl mb-5"
          style={{ background: '#FFF4E8' }}>🙏</div>
        <h2 className="font-bold text-slate-900 text-xl">Thank you!</h2>
        <p className="text-slate-400 text-sm mt-2 max-w-xs leading-relaxed">
          Your feedback has been recorded. You can update it anytime before the event ends.
        </p>
        <button onClick={() => setSaved(false)} className="mt-6 text-sm font-semibold"
          style={{ color: '#FE9234' }}>
          Edit my feedback →
        </button>
      </div>
    );
  }

  if (!questions.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center px-4">
        <div className="text-4xl mb-4">📋</div>
        <p className="font-semibold text-slate-600">No questions configured yet</p>
        <p className="text-sm text-slate-400 mt-1">Check back soon</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 pb-8">

      {/* Anonymous banner */}
      <div className="flex items-start gap-3 px-4 py-3.5 rounded-2xl"
        style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
        <span className="text-lg mt-0.5 shrink-0">🔒</span>
        <div>
          <p className="text-sm font-bold text-green-800">Your feedback is 100% anonymous</p>
          <p className="text-xs text-green-700 mt-0.5 leading-relaxed">
            Your name and identity will never be shown alongside your responses. Share honestly!
          </p>
        </div>
      </div>

      {existing && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-2xl text-sm font-medium"
          style={{ background: '#FFF4E8', color: '#C85F10' }}>
          <span>✏️</span> Editing your existing response — changes will be saved.
        </div>
      )}

      {/* Dynamic questions */}
      {questions.map((q, idx) => (
        <div key={q.id} className="card px-5 py-4 space-y-3">
          <div>
            <p className="font-semibold text-slate-900 text-[15px] leading-snug">
              {idx + 1}. {q.title}
              {q.required === 1 && <span className="text-red-400 ml-1 text-xs font-bold">Required</span>}
            </p>
            {q.subtitle && (
              <p className="text-xs text-slate-400 mt-0.5">{q.subtitle}</p>
            )}
          </div>

          {/* Rating */}
          {q.type === 'rating' && (
            <div className="space-y-1">
              <StarRating
                value={(answers[String(q.id)] as number) ?? 0}
                onChange={v => set(q.id, v)}
              />
              <div className="flex justify-between px-1">
                {['Poor', '', '', '', 'Excellent'].map((label, i) => (
                  <span key={i} className="text-[9px] text-slate-400 w-11 text-center">{label}</span>
                ))}
              </div>
            </div>
          )}

          {/* Text */}
          {q.type === 'text' && (
            <textarea
              className="input resize-none text-sm"
              rows={3}
              placeholder="Type your answer…"
              value={(answers[String(q.id)] as string) ?? ''}
              onChange={e => set(q.id, e.target.value)}
            />
          )}

          {/* Multiple choice */}
          {q.type === 'choice' && q.options && (
            <div className="flex flex-wrap gap-2">
              {(JSON.parse(q.options) as string[]).map(opt => {
                const sel = answers[String(q.id)] === opt;
                return (
                  <button key={opt} type="button"
                    onClick={() => set(q.id, sel ? '' : opt)}
                    className="px-4 py-2 rounded-xl text-sm font-semibold transition border"
                    style={{
                      background:   sel ? '#FFF4E8' : 'white',
                      borderColor:  sel ? '#FE9234' : '#E2E8F0',
                      color:        sel ? '#EA580C' : '#475569',
                    }}>
                    {opt}
                  </button>
                );
              })}
            </div>
          )}

          {/* Yes / No */}
          {q.type === 'yesno' && (
            <div className="flex gap-3">
              {(['Yes', 'No'] as const).map(opt => {
                const sel = answers[String(q.id)] === opt;
                return (
                  <button key={opt} type="button"
                    onClick={() => set(q.id, sel ? '' : opt)}
                    className="flex-1 py-3 rounded-xl text-sm font-bold transition border"
                    style={{
                      background:  sel ? (opt === 'Yes' ? '#DCFCE7' : '#FEE2E2') : 'white',
                      borderColor: sel ? (opt === 'Yes' ? '#86EFAC' : '#FCA5A5') : '#E2E8F0',
                      color:       sel ? (opt === 'Yes' ? '#16A34A' : '#DC2626') : '#64748B',
                    }}>
                    {opt === 'Yes' ? '👍 Yes' : '👎 No'}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ))}

      {error && (
        <p className="text-xs text-red-500 font-semibold px-1 flex items-center gap-1">
          ⚠️ {error}
        </p>
      )}

      <button type="submit" disabled={submitting} className="btn-primary">
        {submitting ? 'Submitting…' : existing ? 'Update Feedback' : 'Submit Feedback'}
      </button>
    </form>
  );
}
