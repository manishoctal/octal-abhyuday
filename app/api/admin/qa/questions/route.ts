import { NextResponse } from 'next/server';
import { requireAdmin, isErrorResponse } from '@/lib/api-helpers';
import {
  createQuestion,
  deleteQuestion,
  getQaSession,
  getQuestion,
  listQuestions,
  moveQuestion,
  updateQuestion,
} from '@/lib/qa';
import { broadcast } from '@/lib/events';
import type { QaQuestionType } from '@/lib/types';

export const dynamic = 'force-dynamic';

function validate(body: Record<string, unknown>) {
  const type =
    body.type === 'mcq' || body.type === 'text' || body.type === 'rating' || body.type === 'rank'
      ? (body.type as QaQuestionType)
      : null;
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  let options: string[] = [];
  let correctOption: number | null = null;

  if (!type) return { error: 'Type must be mcq, text, rating or rank' } as const;
  if (!prompt || prompt.length > 300) return { error: 'Question must be 1–300 characters' } as const;

  if (type === 'mcq' || type === 'rank') {
    options = Array.isArray(body.options)
      ? (body.options as unknown[]).map((o) => String(o).trim()).filter(Boolean)
      : [];
    if (options.length < 2 || options.length > (type === 'rank' ? 8 : 6)) {
      return { error: `${type === 'rank' ? 'Ranking' : 'MCQ'} needs 2–${type === 'rank' ? 8 : 6} options` } as const;
    }
  }
  if (type === 'mcq') {
    if (body.correctOption !== null && body.correctOption !== undefined && body.correctOption !== '') {
      const idx = Number(body.correctOption);
      if (isNaN(idx) || idx < 0 || idx >= options.length) {
        return { error: 'Correct option is out of range' } as const;
      }
      correctOption = idx;
    }
  }
  return { type, prompt, options, correctOption } as const;
}

export async function GET(req: Request) {
  const session = await requireAdmin();
  if (isErrorResponse(session)) return session;

  const sessionId = Number(new URL(req.url).searchParams.get('sessionId'));
  if (!getQaSession(sessionId)) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }
  return NextResponse.json({ questions: listQuestions(sessionId) });
}

export async function POST(req: Request) {
  const session = await requireAdmin();
  if (isErrorResponse(session)) return session;

  const body = await req.json().catch(() => ({}));
  const qaSession = typeof body.sessionId === 'number' ? getQaSession(body.sessionId) : undefined;
  if (!qaSession) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

  const v = validate(body);
  if ('error' in v) return NextResponse.json({ error: v.error }, { status: 400 });

  const question = createQuestion(qaSession.id, v.type, v.prompt, v.options, v.correctOption);
  return NextResponse.json({ ok: true, question });
}

export async function PUT(req: Request) {
  const session = await requireAdmin();
  if (isErrorResponse(session)) return session;

  const body = await req.json().catch(() => ({}));
  const question = typeof body.id === 'number' ? getQuestion(body.id) : undefined;
  if (!question) return NextResponse.json({ error: 'Question not found' }, { status: 404 });

  if (body.move === 'up' || body.move === 'down') {
    moveQuestion(question.id, body.move);
    return NextResponse.json({ ok: true });
  }

  const v = validate({ ...body, type: question.type });
  if ('error' in v) return NextResponse.json({ error: v.error }, { status: 400 });

  updateQuestion(question.id, v.prompt, v.options, v.correctOption);
  if (question.state !== 'pending') broadcast('qa');
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const session = await requireAdmin();
  if (isErrorResponse(session)) return session;

  const { id } = await req.json().catch(() => ({}));
  const question = typeof id === 'number' ? getQuestion(id) : undefined;
  if (!question) return NextResponse.json({ error: 'Question not found' }, { status: 404 });

  deleteQuestion(question.id);
  if (question.state !== 'pending') broadcast('qa');
  return NextResponse.json({ ok: true });
}
