import { NextResponse } from 'next/server';
import { requireUser, isErrorResponse } from '@/lib/api-helpers';
import { getQuestion, getQaSession, upsertAnswer } from '@/lib/qa';
import { broadcast } from '@/lib/events';

export async function POST(req: Request) {
  const session = await requireUser();
  if (isErrorResponse(session)) return session;

  const { questionId, value, isAnonymous } = await req.json().catch(() => ({}));
  const question = typeof questionId === 'number' ? getQuestion(questionId) : undefined;
  if (!question) return NextResponse.json({ error: 'Question not found' }, { status: 404 });

  const qaSession = getQaSession(question.session_id);
  if (!qaSession || qaSession.status !== 'live' || question.state !== 'live') {
    return NextResponse.json(
      { error: question.state === 'revealed' ? 'Answers are locked — already revealed' : 'This question is not live' },
      { status: 409 }
    );
  }

  if (typeof value !== 'string' || !value.trim() || value.length > 280) {
    return NextResponse.json({ error: 'Answer must be 1–280 characters' }, { status: 400 });
  }

  if (question.type === 'mcq') {
    const idx = parseInt(value, 10);
    if (isNaN(idx) || idx < 0 || idx >= question.options.length) {
      return NextResponse.json({ error: 'Invalid option' }, { status: 400 });
    }
  }
  if (question.type === 'rating') {
    const v = parseInt(value, 10);
    if (isNaN(v) || v < 1 || v > 5) {
      return NextResponse.json({ error: 'Rating must be 1–5' }, { status: 400 });
    }
  }
  if (question.type === 'rank') {
    let order: unknown;
    try {
      order = JSON.parse(value);
    } catch {
      order = null;
    }
    const n = question.options.length;
    const valid =
      Array.isArray(order) &&
      order.length === n &&
      [...order].sort((a, b) => Number(a) - Number(b)).every((v, i) => v === i);
    if (!valid) {
      return NextResponse.json({ error: 'Ranking must order every option exactly once' }, { status: 400 });
    }
  }

  upsertAnswer(question.id, session.id, value.trim(), !!isAnonymous);
  broadcast('qa');
  return NextResponse.json({ ok: true });
}
