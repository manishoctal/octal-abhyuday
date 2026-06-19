'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { AnimatePresence, motion } from 'framer-motion';
import { useRealtime } from '../useRealtime';
import type { QaQuestion, QaQuestionType, QaSession } from '@/lib/types';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type SessionRow = QaSession & { question_count: number };

export default function QnaModule() {
  const [openSessionId, setOpenSessionId] = useState<number | null>(null);
  const [toast, setToast] = useState('');

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  return (
    <div>
      {openSessionId === null ? (
        <SessionList onOpen={setOpenSessionId} notify={notify} />
      ) : (
        <SessionEditor sessionId={openSessionId} onBack={() => setOpenSessionId(null)} notify={notify} />
      )}

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-sm font-semibold px-5 py-3 rounded-full shadow-xl max-w-[90vw] text-center"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------------- Session list ---------------- */

const statusChip: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  live: 'bg-green-100 text-green-700 animate-pulse',
  ended: 'bg-red-50 text-red-600',
};

function SessionList({
  onOpen,
  notify,
}: {
  onOpen: (id: number) => void;
  notify: (m: string) => void;
}) {
  useRealtime(['/api/admin/qa/sessions']);
  const { data, mutate } = useSWR<{ sessions: SessionRow[] }>('/api/admin/qa/sessions', fetcher, {
    refreshInterval: 15000,
  });
  const [title, setTitle] = useState('');
  const [creating, setCreating] = useState(false);

  async function createSession(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch('/api/admin/qa/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      const body = await res.json();
      if (!res.ok) {
        notify(body.error ?? 'Could not create session');
        return;
      }
      setTitle('');
      mutate();
      onOpen(body.session.id);
    } finally {
      setCreating(false);
    }
  }

  async function remove(s: SessionRow) {
    if (!window.confirm(`Delete session "${s.title}" with all its questions and answers?`)) return;
    const res = await fetch('/api/admin/qa/sessions', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: s.id }),
    });
    notify(res.ok ? 'Session deleted' : 'Delete failed');
    mutate();
  }

  if (!data) return <Spinner />;

  return (
    <div className="space-y-5">
      <form onSubmit={createSession} className="bg-white rounded-2xl border border-slate-200 p-5 flex gap-3">
        <input
          placeholder="New session title, e.g. ABHYUDAY Funny Round"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          maxLength={80}
          className="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <button
          type="submit"
          disabled={creating}
          className="rounded-xl bg-brand-600 px-5 font-bold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          + Create
        </button>
      </form>

      {data.sessions.filter((s) => s.kind === 'qna').length === 0 ? (
        <p className="text-sm text-slate-400 bg-white border border-slate-200 rounded-2xl p-6 text-center">
          No sessions yet — create your first Q&amp;A session above.
        </p>
      ) : (
        <div className="space-y-3">
          {data.sessions.filter((s) => s.kind === 'qna').map((s) => (
            <div key={s.id} className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-900 truncate">{s.title}</p>
                <p className="text-xs text-slate-400">{s.question_count} questions</p>
              </div>
              <span className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase ${statusChip[s.status]}`}>
                {s.status}
              </span>
              <button
                onClick={() => onOpen(s.id)}
                className="shrink-0 rounded-xl bg-brand-50 text-brand-700 hover:bg-brand-100 px-4 py-2 text-sm font-bold"
              >
                Open
              </button>
              <button
                onClick={() => remove(s)}
                className="shrink-0 rounded-xl text-red-600 hover:bg-red-50 px-3 py-2 text-sm font-semibold"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- Session editor + presenter ---------------- */

const typeMeta: Record<QaQuestionType, { label: string; emoji: string }> = {
  mcq: { label: 'Quiz / Multiple choice', emoji: '🧠' },
  text: { label: 'Open text (funny answers)', emoji: '💬' },
  rating: { label: 'Rating 1–5', emoji: '⭐' },
  rank: { label: 'Ranking', emoji: '🏅' },
};

const qStateChip: Record<string, string> = {
  pending: 'bg-slate-100 text-slate-500',
  live: 'bg-green-100 text-green-700 animate-pulse',
  revealed: 'bg-amber-100 text-amber-700',
};

function SessionEditor({
  sessionId,
  onBack,
  notify,
}: {
  sessionId: number;
  onBack: () => void;
  notify: (m: string) => void;
}) {
  useRealtime([`/api/admin/qa/questions?sessionId=${sessionId}`, '/api/admin/qa/sessions']);
  const sessions = useSWR<{ sessions: SessionRow[] }>('/api/admin/qa/sessions', fetcher, {
    refreshInterval: 15000,
  });
  const questions = useSWR<{ questions: QaQuestion[] }>(
    `/api/admin/qa/questions?sessionId=${sessionId}`,
    fetcher,
    { refreshInterval: 15000 }
  );

  const session = sessions.data?.sessions.find((s) => s.id === sessionId);

  async function present(action: string, payload: Record<string, unknown>, confirmMsg?: string) {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    const res = await fetch('/api/admin/qa/present', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...payload }),
    });
    const body = await res.json();
    notify(res.ok ? 'Done ✅' : (body.error ?? 'Action failed'));
    sessions.mutate();
    questions.mutate();
  }

  async function questionAction(method: string, payload: Record<string, unknown>, okMsg: string) {
    const res = await fetch('/api/admin/qa/questions', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await res.json();
    notify(res.ok ? okMsg : (body.error ?? 'Failed'));
    questions.mutate();
  }

  if (!session || !questions.data) return <Spinner />;
  const qs = questions.data.questions;
  const liveQuestion = qs.find((q) => q.state === 'live');

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="text-sm font-semibold text-brand-600 hover:text-brand-700">
        ← All sessions
      </button>

      {/* Session header + lifecycle */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <h2 className="text-lg font-extrabold text-slate-900 truncate">{session.title}</h2>
            <span className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase ${statusChip[session.status]}`}>
              {session.status}
            </span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {session.status !== 'live' ? (
              <button
                onClick={() =>
                  present('start_session', { sessionId }, session.status === 'ended' ? 'Restart this ended session?' : undefined)
                }
                className="rounded-xl bg-green-600 text-white px-4 py-2.5 text-sm font-bold hover:bg-green-700"
              >
                ▶️ {session.status === 'ended' ? 'Restart' : 'Go Live'}
              </button>
            ) : (
              <button
                onClick={() => present('end_session', { sessionId }, 'End this session for everyone?')}
                className="rounded-xl bg-red-600 text-white px-4 py-2.5 text-sm font-bold hover:bg-red-700"
              >
                🏁 End Session
              </button>
            )}
            <a
              href="/stage"
              target="_blank"
              rel="noreferrer"
              className="rounded-xl bg-slate-900 text-white px-4 py-2.5 text-sm font-bold hover:bg-slate-700"
            >
              🖥️ Open Stage View
            </a>
          </div>
        </div>
        {session.status === 'live' && (
          <p className="mt-3 text-sm font-semibold text-green-700 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
            {liveQuestion
              ? `🎤 Now presenting: “${liveQuestion.prompt}”`
              : '🎤 Session is live — present a question below to put it on everyone’s screen.'}
          </p>
        )}
      </div>

      {/* Question deck */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h3 className="font-bold text-slate-900 mb-3">Question deck ({qs.length})</h3>
        {qs.length === 0 ? (
          <p className="text-sm text-slate-400">No questions yet — add some below.</p>
        ) : (
          <div className="space-y-2">
            {qs.map((q, i) => (
              <div
                key={q.id}
                className={`rounded-xl border p-3 ${q.state === 'live' ? 'border-green-400 bg-green-50/50' : 'border-slate-100'}`}
              >
                <div className="flex items-start gap-2">
                  <span className="text-lg shrink-0">{typeMeta[q.type].emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800">{q.prompt}</p>
                    {(q.type === 'mcq' || q.type === 'rank') && (
                      <p className="text-xs text-slate-400 mt-0.5 truncate">
                        {q.options
                          .map((o, oi) => (q.type === 'mcq' && oi === q.correct_option ? `✓ ${o}` : o))
                          .join('  ·  ')}
                      </p>
                    )}
                  </div>
                  <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${qStateChip[q.state]}`}>
                    {q.state}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  {session.status === 'live' && q.state !== 'live' && (
                    <button
                      onClick={() => present('push', { questionId: q.id })}
                      className="rounded-lg bg-brand-600 text-white px-3 py-1.5 text-xs font-bold hover:bg-brand-700"
                    >
                      🎤 Present{q.state === 'revealed' ? ' again' : ''}
                    </button>
                  )}
                  {q.state === 'live' && (
                    <button
                      onClick={() => present('reveal', { questionId: q.id })}
                      className="rounded-lg bg-amber-500 text-white px-3 py-1.5 text-xs font-bold hover:bg-amber-600"
                    >
                      ✨ Reveal
                    </button>
                  )}
                  <span className="flex-1" />
                  <button
                    onClick={() => questionAction('PUT', { id: q.id, move: 'up' }, 'Moved')}
                    disabled={i === 0}
                    className="rounded-lg px-2 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => questionAction('PUT', { id: q.id, move: 'down' }, 'Moved')}
                    disabled={i === qs.length - 1}
                    className="rounded-lg px-2 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm('Delete this question (and its answers)?'))
                        questionAction('DELETE', { id: q.id }, 'Question deleted');
                    }}
                    className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AddQuestionForm
        sessionId={sessionId}
        onAdded={() => questions.mutate()}
        notify={notify}
      />
    </div>
  );
}

function AddQuestionForm({
  sessionId,
  onAdded,
  notify,
}: {
  sessionId: number;
  onAdded: () => void;
  notify: (m: string) => void;
}) {
  const [type, setType] = useState<QaQuestionType>('mcq');
  const [prompt, setPrompt] = useState('');
  const [optionsText, setOptionsText] = useState('');
  const [correct, setCorrect] = useState<string>('');
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const options = optionsText.split('\n').map((s) => s.trim()).filter(Boolean);
      const res = await fetch('/api/admin/qa/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          type,
          prompt,
          options,
          correctOption: type === 'mcq' && correct !== '' ? Number(correct) : null,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        notify(body.error ?? 'Could not add question');
        return;
      }
      notify('Question added ✅');
      setPrompt('');
      setOptionsText('');
      setCorrect('');
      onAdded();
    } finally {
      setSaving(false);
    }
  }

  const optionLines = optionsText.split('\n').map((s) => s.trim()).filter(Boolean);

  return (
    <form onSubmit={save} className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
      <h3 className="font-bold text-slate-900">Add question</h3>
      <div className="flex gap-2 flex-wrap">
        {(Object.keys(typeMeta) as QaQuestionType[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={`rounded-xl px-3 py-2 text-sm font-bold transition ${
              type === t ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {typeMeta[t].emoji} {typeMeta[t].label}
          </button>
        ))}
      </div>
      <input
        placeholder="Question text"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        required
        maxLength={300}
        className="w-full rounded-xl border border-slate-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
      />
      {(type === 'mcq' || type === 'rank') && (
        <textarea
          placeholder={
            type === 'rank'
              ? 'One item per line (2–8) — the crowd ranks them\ne.g.\nDance performance\nSinging\nStand-up comedy'
              : 'One option per line (2–6 options)\ne.g.\nMumbai\nDelhi\nJaipur'
          }
          value={optionsText}
          onChange={(e) => setOptionsText(e.target.value)}
          rows={4}
          className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      )}
      {type === 'mcq' && (
        <>
          <div className="flex items-center gap-3">
            <label htmlFor="correct-option" className="text-sm font-semibold text-slate-600">
              Correct answer (optional, for quiz scoring):
            </label>
            <select
              id="correct-option"
              value={correct}
              onChange={(e) => setCorrect(e.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white"
            >
              <option value="">— none —</option>
              {optionLines.map((o, i) => (
                <option key={i} value={i}>
                  {o}
                </option>
              ))}
            </select>
          </div>
        </>
      )}
      {type === 'text' && (
        <p className="text-xs text-slate-500">
          💬 Everyone types a short answer (can be anonymous) and upvotes the funniest ones.
        </p>
      )}
      {type === 'rating' && (
        <p className="text-xs text-slate-500">⭐ Everyone rates 1–5; the reveal shows the average and spread.</p>
      )}
      {type === 'rank' && (
        <p className="text-xs text-slate-500">
          🏅 Everyone orders the items on their phone; the reveal shows the combined crowd ranking.
        </p>
      )}
      <button
        type="submit"
        disabled={saving}
        className="rounded-xl bg-brand-600 text-white px-5 py-2.5 font-bold hover:bg-brand-700 disabled:opacity-50"
      >
        {saving ? 'Adding…' : '+ Add question'}
      </button>
    </form>
  );
}

function Spinner() {
  return (
    <div className="flex justify-center py-16">
      <div className="w-10 h-10 rounded-full border-4 border-brand-200 border-t-brand-600 animate-spin" />
    </div>
  );
}
