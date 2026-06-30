'use client';

import { useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import confetti from 'canvas-confetti';
import { AnimatePresence, motion } from 'framer-motion';
import { useRealtime } from './useRealtime';
import type {
  QaLeaderboardRow,
  QaQuestionState,
  QaQuestionType,
  QaResults,
  QaSessionKind,
} from '@/lib/types';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const kindEmoji: Record<QaSessionKind, string> = { qna: '💬', poll: '📊', ranking: '🏅' };

interface QaResponse {
  session: { id: number; title: string; status: string; kind: QaSessionKind } | null;
  question: {
    id: number;
    type: QaQuestionType;
    prompt: string;
    options: string[];
    state: QaQuestionState;
    correct_option: number | null;
  } | null;
  myAnswer: { value: string; isAnonymous: boolean } | null;
  answerCount?: number;
  results: QaResults | null;
  leaderboard?: QaLeaderboardRow[];
  votingState: string;
  eventName: string;
}

export default function QnaClient() {
  useRealtime(['/api/qa']);
  const { data, mutate } = useSWR<QaResponse>('/api/qa', fetcher, { refreshInterval: 15000 });
  const [toast, setToast] = useState('');

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  // Confetti when an MCQ reveal shows I was right
  const lastRevealed = useRef<number | null>(null);
  useEffect(() => {
    const q = data?.question;
    if (
      q &&
      q.state === 'revealed' &&
      q.type === 'mcq' &&
      q.correct_option !== null &&
      data?.myAnswer &&
      Number(data.myAnswer.value) === q.correct_option &&
      lastRevealed.current !== q.id
    ) {
      lastRevealed.current = q.id;
      confetti({ particleCount: 90, spread: 75, origin: { y: 0.7 }, zIndex: 60 });
    }
  }, [data]);

  if (!data) {
    return (
      <div className="flex justify-center py-24">
        <div className="w-10 h-10 rounded-full border-4 border-brand-200 border-t-brand-600 animate-spin" />
      </div>
    );
  }

  const hero = (
    <div className="text-center mt-1 mb-4">
      <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.25em] text-brand-500">
        Octal IT Solution LLP presents
      </p>
      <h1 className="text-3xl sm:text-4xl font-black gold-text leading-tight">{data.eventName}</h1>
      {data.session && (
        <p className="text-sm font-bold text-slate-600 mt-1">
          {kindEmoji[data.session.kind]} {data.session.title}
        </p>
      )}
    </div>
  );

  const votingBanner = data.votingState === 'live' && (
    <Link
      href="/"
      className="block mb-4 rounded-2xl bg-brand-50 border border-brand-200 px-4 py-3 text-brand-700 font-semibold text-sm hover:bg-brand-100 transition"
    >
      🗳️ Popularity voting is also live — tap to cast your vote!
    </Link>
  );

  // No session at all
  if (!data.session) {
    return (
      <div>
        {hero}
        {votingBanner}
        <WaitingHero
          emoji="🎤"
          title="No live session right now"
          subtitle="This page will come alive the moment the host starts a Q&A session."
        />
      </div>
    );
  }

  const ended = data.session.status === 'ended';

  // Session exists but nothing to show
  if (!data.question) {
    return (
      <div>
        {hero}
        {votingBanner}
        {ended && data.leaderboard && data.leaderboard.length > 0 ? (
          <Leaderboard rows={data.leaderboard} title={`${data.session.title} — Final standings`} />
        ) : ended ? (
          <WaitingHero
            emoji="🎤"
            title="Session over — thanks for playing!"
            subtitle="This page will come alive the moment the host starts the next session."
          />
        ) : (
          <WaitingHero
            emoji="🥁"
            title="Get ready…"
            subtitle="The host is live! The first question will appear here any second."
            pulse
          />
        )}
      </div>
    );
  }

  const q = data.question;
  const revealed = q.state === 'revealed';

  return (
    <div>
      {hero}
      {votingBanner}

      <motion.div
        key={q.id + q.state}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 sm:p-6"
      >
        <div className="flex items-center justify-between gap-2 mb-3">
          <span
            className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide ${
              revealed ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700 animate-pulse'
            }`}
          >
            {revealed ? '✨ Revealed' : '🔴 Live'}
          </span>
          <span className="text-xs font-semibold text-slate-400">
            {data.answerCount ?? 0} answered
          </span>
        </div>

        <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 leading-snug">{q.prompt}</h2>

        <div className="mt-5">
          {q.type === 'mcq' && (
            <McqAnswer
              question={q}
              myAnswer={data.myAnswer?.value ?? null}
              results={data.results}
              onAnswer={async (idx) => {
                const ok = await submitAnswer(q.id, String(idx), false, notify);
                if (ok) mutate();
              }}
            />
          )}
          {q.type === 'rating' && (
            <RatingAnswer
              myAnswer={data.myAnswer?.value ?? null}
              results={data.results}
              revealed={revealed}
              onAnswer={async (v) => {
                const ok = await submitAnswer(q.id, String(v), false, notify);
                if (ok) mutate();
              }}
            />
          )}
          {q.type === 'text' && (
            <TextAnswer
              questionId={q.id}
              myAnswer={data.myAnswer}
              results={data.results}
              revealed={revealed}
              notify={notify}
              onChanged={() => mutate()}
            />
          )}
          {q.type === 'rank' && (
            <RankAnswer
              options={q.options}
              myAnswer={data.myAnswer?.value ?? null}
              results={data.results}
              revealed={revealed}
              onAnswer={async (v) => {
                const ok = await submitAnswer(q.id, v, false, notify);
                if (ok) mutate();
              }}
            />
          )}
        </div>
      </motion.div>

      {ended && data.leaderboard && data.leaderboard.length > 0 && (
        <div className="mt-4">
          <Leaderboard rows={data.leaderboard} title={`${data.session.title} — Final standings`} />
        </div>
      )}

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-sm font-semibold px-5 py-3 rounded-full shadow-xl whitespace-nowrap"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

async function submitAnswer(
  questionId: number,
  value: string,
  isAnonymous: boolean,
  notify: (m: string) => void
): Promise<boolean> {
  const res = await fetch('/api/qa/answer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ questionId, value, isAnonymous }),
  });
  const body = await res.json();
  if (!res.ok) {
    notify(body.error ?? 'Could not save answer');
    return false;
  }
  notify('Answer saved ✅ (you can change it until the reveal)');
  return true;
}

/* ---------------- MCQ ---------------- */

function McqAnswer({
  question,
  myAnswer,
  results,
  onAnswer,
}: {
  question: { options: string[]; correct_option: number | null; state: QaQuestionState };
  myAnswer: string | null;
  results: QaResults | null;
  onAnswer: (idx: number) => void;
}) {
  const counts = results?.counts;
  const total = counts ? counts.reduce((a, b) => a + b, 0) : 0;
  const revealed = question.state === 'revealed';
  const myIdx = myAnswer !== null ? Number(myAnswer) : null;

  return (
    <div className="space-y-2.5">
      {question.options.map((opt, i) => {
        const isMine = myIdx === i;
        const isCorrect = revealed && question.correct_option === i;
        const isWrongMine = revealed && isMine && question.correct_option !== null && !isCorrect;
        const pct = counts && total > 0 ? Math.round((counts[i] / total) * 100) : 0;
        return (
          <button
            key={i}
            disabled={revealed}
            onClick={() => onAnswer(i)}
            className={`relative w-full text-left rounded-2xl border-2 px-4 py-3 font-semibold transition overflow-hidden ${
              isCorrect
                ? 'border-green-500 bg-green-50 text-green-800'
                : isWrongMine
                  ? 'border-red-400 bg-red-50 text-red-700'
                  : isMine
                    ? 'border-brand-500 bg-brand-50 text-brand-800'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-brand-300'
            } ${revealed ? 'cursor-default' : 'active:scale-[0.99]'}`}
          >
            {counts && (
              <motion.span
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.6 }}
                className={`absolute inset-y-0 left-0 ${isCorrect ? 'bg-green-200/60' : isMine && !revealed ? 'bg-brand-100' : 'bg-slate-100'}`}
              />
            )}
            <span className="relative flex items-center justify-between gap-2">
              <span>
                {isCorrect && '✅ '}
                {isWrongMine && '❌ '}
                {!revealed && isMine && '🔘 '}
                {opt}
              </span>
              {counts && (
                <span className="text-sm font-bold shrink-0">
                  {pct}% ({counts[i]})
                </span>
              )}
            </span>
          </button>
        );
      })}
      {!revealed && (
        <p className="text-xs text-slate-400 text-center">
          {myIdx !== null
            ? counts
              ? 'Live results — tap another option to change your vote.'
              : 'Answer locked in — tap another to change it before the reveal.'
            : 'Tap an option to answer!'}
        </p>
      )}
      {revealed && question.correct_option !== null && myIdx !== null && (
        <p className={`text-center font-bold ${myIdx === question.correct_option ? 'text-green-600' : 'text-red-500'}`}>
          {myIdx === question.correct_option ? '🎉 You got it right!' : 'Better luck on the next one!'}
        </p>
      )}
    </div>
  );
}

/* ---------------- Ranking (tap in order) ---------------- */

function RankAnswer({
  options,
  myAnswer,
  results,
  revealed,
  onAnswer,
}: {
  options: string[];
  myAnswer: string | null;
  results: QaResults | null;
  revealed: boolean;
  onAnswer: (valueJson: string) => void;
}) {
  const initial = (): number[] => {
    try {
      const parsed = myAnswer ? (JSON.parse(myAnswer) as number[]) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };
  const [order, setOrder] = useState<number[]>(initial);
  const [editing, setEditing] = useState(myAnswer === null);
  const points = results?.counts;

  function toggle(i: number) {
    setOrder((o) => (o.includes(i) ? o.filter((x) => x !== i) : [...o, i]));
  }

  // Results view (revealed, or submitted live crowd ranking)
  if (!editing || revealed) {
    if (points) {
      const maxPts = Math.max(1, ...points);
      const ranked = options
        .map((opt, i) => ({ opt, i, pts: points[i] }))
        .sort((a, b) => b.pts - a.pts);
      const myOrder = initial();
      const medal = (pos: number) => (pos === 0 ? '🥇' : pos === 1 ? '🥈' : pos === 2 ? '🥉' : `${pos + 1}`);
      return (
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">
            {revealed ? '🏅 Final crowd ranking' : '🏅 Live crowd ranking'}
          </p>
          <motion.div layout className="space-y-2">
            {ranked.map((r, pos) => (
              <motion.div
                layout
                layoutId={`rank-${r.i}`}
                key={r.i}
                transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                className={`rounded-2xl border px-4 py-3 ${pos === 0 ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'}`}
              >
                <div className="flex items-center justify-between gap-2 font-semibold text-slate-800">
                  <span>
                    {medal(pos)} {r.opt}
                  </span>
                  <span className="text-xs font-bold text-slate-400 shrink-0">
                    {r.pts} pts
                    {myOrder.indexOf(r.i) >= 0 && (
                      <span className="ml-2 text-brand-600">· your #{myOrder.indexOf(r.i) + 1}</span>
                    )}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <motion.div
                    animate={{ width: `${(r.pts / maxPts) * 100}%` }}
                    className={`h-full rounded-full ${pos === 0 ? 'bg-amber-400' : 'bg-brand-500'}`}
                  />
                </div>
              </motion.div>
            ))}
          </motion.div>
          {!revealed && (
            <button
              onClick={() => setEditing(true)}
              className="mt-3 w-full rounded-xl border border-slate-300 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50"
            >
              ✏️ Change my ranking
            </button>
          )}
        </div>
      );
    }
    return <p className="text-center text-sm text-slate-400">Ranking submitted ✅ — waiting for the reveal…</p>;
  }

  // Editing: tap options in your preferred order
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">
        Tap in your order of preference — #1 first
      </p>
      <div className="space-y-2">
        {options.map((opt, i) => {
          const pos = order.indexOf(i);
          const picked = pos >= 0;
          return (
            <button
              key={i}
              onClick={() => toggle(i)}
              className={`w-full flex items-center gap-3 rounded-2xl border-2 px-4 py-3 font-semibold text-left transition active:scale-[0.99] ${
                picked ? 'border-brand-500 bg-brand-50 text-brand-800' : 'border-slate-200 bg-white text-slate-700 hover:border-brand-300'
              }`}
            >
              <span
                className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-extrabold ${
                  picked ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-400'
                }`}
              >
                {picked ? pos + 1 : '·'}
              </span>
              {opt}
            </button>
          );
        })}
      </div>
      <div className="flex gap-3 mt-3">
        <button
          onClick={() => setOrder([])}
          disabled={order.length === 0}
          className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-600 disabled:opacity-40"
        >
          Reset
        </button>
        <button
          onClick={() => {
            onAnswer(JSON.stringify(order));
            setEditing(false);
          }}
          disabled={order.length !== options.length}
          className="flex-1 rounded-xl bg-brand-600 text-white py-2.5 font-bold hover:bg-brand-700 disabled:opacity-40"
        >
          {order.length === options.length
            ? 'Submit ranking 🚀'
            : `Pick ${options.length - order.length} more`}
        </button>
      </div>
    </div>
  );
}

/* ---------------- Rating ---------------- */

function RatingAnswer({
  myAnswer,
  results,
  revealed,
  onAnswer,
}: {
  myAnswer: string | null;
  results: QaResults | null;
  revealed: boolean;
  onAnswer: (v: number) => void;
}) {
  const mine = myAnswer !== null ? Number(myAnswer) : null;
  const counts = results?.counts;
  const max = counts ? Math.max(1, ...counts) : 1;

  return (
    <div>
      <div className="flex justify-center gap-2 sm:gap-3">
        {[1, 2, 3, 4, 5].map((v) => (
          <button
            key={v}
            disabled={revealed}
            onClick={() => onAnswer(v)}
            className={`text-3xl sm:text-4xl transition ${revealed ? 'cursor-default' : 'hover:scale-125 active:scale-95'} ${
              mine !== null && v <= mine ? '' : 'grayscale opacity-40'
            }`}
            aria-label={`${v} star${v > 1 ? 's' : ''}`}
          >
            ⭐
          </button>
        ))}
      </div>
      {!revealed && (
        <p className="text-xs text-slate-400 text-center mt-3">
          {mine !== null ? `You rated ${mine}/5 — tap to change before the reveal.` : 'Tap a star to rate!'}
        </p>
      )}
      {revealed && counts && (
        <div className="mt-5">
          <p className="text-center text-3xl font-black text-slate-900">
            {results?.average ?? '—'} <span className="text-base font-bold text-slate-400">/ 5 average</span>
          </p>
          <div className="flex items-end justify-center gap-2 h-24 mt-4">
            {counts.map((c, i) => (
              <div key={i} className="flex flex-col items-center gap-1 w-10">
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${(c / max) * 100}%` }}
                  className="w-full rounded-t-lg bg-amber-400 min-h-[2px]"
                  style={{ height: `${(c / max) * 80}px` }}
                />
                <span className="text-xs font-bold text-slate-500">{i + 1}⭐</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Open text ---------------- */

function TextAnswer({
  questionId,
  myAnswer,
  results,
  revealed,
  notify,
  onChanged,
}: {
  questionId: number;
  myAnswer: { value: string; isAnonymous: boolean } | null;
  results: QaResults | null;
  revealed: boolean;
  notify: (m: string) => void;
  onChanged: () => void;
}) {
  const [text, setText] = useState(myAnswer?.value ?? '');
  const [anonymous, setAnonymous] = useState(myAnswer?.isAnonymous ?? false);
  const [sending, setSending] = useState(false);
  const answers = results?.answers ?? [];

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    try {
      const ok = await submitAnswer(questionId, text, anonymous, notify);
      if (ok) onChanged();
    } finally {
      setSending(false);
    }
  }

  async function upvote(answerId: number) {
    await fetch('/api/qa/upvote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answerId }),
    });
    onChanged();
  }

  const medal = (i: number) => (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null);

  return (
    <div>
      {!revealed && (
        <form onSubmit={send} className="space-y-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type your answer… make it count 😄"
            maxLength={280}
            rows={2}
            required
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={anonymous}
                onChange={(e) => setAnonymous(e.target.checked)}
                className="w-4 h-4 accent-brand-600"
              />
              🥸 Post anonymously
            </label>
            <button
              type="submit"
              disabled={sending}
              className="rounded-xl bg-brand-600 text-white px-5 py-2.5 font-bold hover:bg-brand-700 disabled:opacity-50"
            >
              {sending ? 'Sending…' : myAnswer ? 'Update answer' : 'Send 🚀'}
            </button>
          </div>
        </form>
      )}

      {answers.length > 0 && (
        <div className="mt-5">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-2">
            {revealed ? '🏆 Top answers' : `${answers.length} answer${answers.length === 1 ? '' : 's'} — upvote the best!`}
          </h3>
          <motion.div layout className="space-y-2">
            {answers.map((a, i) => (
              <motion.div
                layout
                layoutId={`answer-${a.id}`}
                key={a.id}
                transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                className={`flex items-start gap-3 rounded-2xl border px-4 py-3 ${
                  revealed && i === 0 && a.upvotes > 0
                    ? 'border-amber-300 bg-amber-50 animate-glow'
                    : a.mine
                      ? 'border-brand-300 bg-brand-50/50'
                      : 'border-slate-200 bg-white'
                }`}
              >
                {revealed && medal(i) && a.upvotes > 0 && <span className="text-xl">{medal(i)}</span>}
                <div className="flex-1 min-w-0">
                  <p className="text-slate-800 font-medium break-words">{a.value}</p>
                  <p className="text-[11px] font-semibold text-slate-400 mt-0.5">
                    {a.name ?? '🥸 Anonymous'}
                    {a.mine && ' · you'}
                  </p>
                </div>
                <button
                  onClick={() => upvote(a.id)}
                  disabled={revealed}
                  className={`shrink-0 flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-bold transition active:scale-90 ${
                    a.upvotedByMe ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  } ${revealed ? 'cursor-default' : ''}`}
                >
                  😂 {a.upvotes}
                </button>
              </motion.div>
            ))}
          </motion.div>
        </div>
      )}
    </div>
  );
}

/* ---------------- shared bits ---------------- */

function WaitingHero({
  emoji,
  title,
  subtitle,
  pulse,
}: {
  emoji: string;
  title: string;
  subtitle: string;
  pulse?: boolean;
}) {
  return (
    <div className="text-center py-20 px-6">
      <motion.div
        animate={pulse ? { scale: [1, 1.2, 1] } : undefined}
        transition={{ repeat: Infinity, duration: 1.2 }}
        className="text-6xl mb-4"
      >
        {emoji}
      </motion.div>
      <h2 className="text-2xl font-extrabold text-slate-900">{title}</h2>
      <p className="text-slate-500 mt-2 max-w-sm mx-auto">{subtitle}</p>
    </div>
  );
}

function Leaderboard({ rows, title }: { rows: QaLeaderboardRow[]; title: string }) {
  const medal = (i: number) => (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`);
  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-5">
      <h2 className="font-extrabold text-slate-900 mb-3">🏆 {title}</h2>
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div
            key={i}
            className={`flex items-center gap-3 rounded-xl px-4 py-2.5 ${i === 0 ? 'bg-amber-50 border border-amber-200' : 'bg-slate-50'}`}
          >
            <span className="w-7 text-center font-bold">{medal(i)}</span>
            <span className="flex-1 font-semibold text-slate-800 truncate">{r.name}</span>
            <span className="font-black text-brand-600">{r.score}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
