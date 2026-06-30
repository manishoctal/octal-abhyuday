import { NextResponse } from 'next/server';
import { requireAdmin, isErrorResponse } from '@/lib/api-helpers';
import { createQaSession, createQuestion, pushQuestionLive, startSession } from '@/lib/qa';
import { broadcast } from '@/lib/events';
import { sendPushToAll } from '@/lib/push';

/** Quick-launch for the Polls and Rankings modules: creates a single-question
 *  session of the given kind and puts it live on every screen immediately. */
export async function POST(req: Request) {
  const session = await requireAdmin();
  if (isErrorResponse(session)) return session;

  const { kind, prompt, options } = await req.json().catch(() => ({}));
  if (kind !== 'poll' && kind !== 'ranking') {
    return NextResponse.json({ error: 'kind must be poll or ranking' }, { status: 400 });
  }
  if (typeof prompt !== 'string' || !prompt.trim() || prompt.trim().length > 300) {
    return NextResponse.json({ error: 'Question must be 1–300 characters' }, { status: 400 });
  }
  const opts = Array.isArray(options)
    ? (options as unknown[]).map((o) => String(o).trim()).filter(Boolean)
    : [];
  if (opts.length < 2 || opts.length > 8) {
    return NextResponse.json({ error: 'Provide 2–8 options' }, { status: 400 });
  }

  const qaSession = createQaSession(prompt.trim().slice(0, 80), kind);
  const question = createQuestion(
    qaSession.id,
    kind === 'poll' ? 'mcq' : 'rank',
    prompt.trim(),
    opts,
    null
  );
  startSession(qaSession.id);
  pushQuestionLive(question.id);

  const alertMap: Record<string, Parameters<typeof broadcast>[1]> = {
    poll:    { kind: 'poll_live',    title: '📊 New Poll is Live!',    body: prompt.trim().slice(0, 80) },
    ranking: { kind: 'ranking_live', title: '🏅 New Ranking is Live!', body: prompt.trim().slice(0, 80) },
  };
  const alert = alertMap[kind];
  broadcast('qa', alert);
  if (alert?.title && alert?.body) sendPushToAll(alert.title, alert.body, '/qna').catch(() => {});

  return NextResponse.json({ ok: true, sessionId: qaSession.id, questionId: question.id });
}
