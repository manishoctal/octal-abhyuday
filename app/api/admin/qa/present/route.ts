import { NextResponse } from 'next/server';
import { requireAdmin, isErrorResponse } from '@/lib/api-helpers';
import {
  endSession,
  getQaSession,
  getQuestion,
  pushQuestionLive,
  revealQuestion,
  startSession,
} from '@/lib/qa';
import { broadcast } from '@/lib/events';

export async function POST(req: Request) {
  const session = await requireAdmin();
  if (isErrorResponse(session)) return session;

  const { action, sessionId, questionId } = await req.json().catch(() => ({}));

  try {
    switch (action) {
      case 'start_session': {
        const s = typeof sessionId === 'number' ? getQaSession(sessionId) : undefined;
        if (!s) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        startSession(s.id);
        break;
      }
      case 'end_session': {
        const s = typeof sessionId === 'number' ? getQaSession(sessionId) : undefined;
        if (!s) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        if (s.status !== 'live') {
          return NextResponse.json({ error: 'Session is not live' }, { status: 409 });
        }
        endSession(s.id);
        break;
      }
      case 'push': {
        const q = typeof questionId === 'number' ? getQuestion(questionId) : undefined;
        if (!q) return NextResponse.json({ error: 'Question not found' }, { status: 404 });
        pushQuestionLive(q.id);
        break;
      }
      case 'reveal': {
        const q = typeof questionId === 'number' ? getQuestion(questionId) : undefined;
        if (!q) return NextResponse.json({ error: 'Question not found' }, { status: 404 });
        if (q.state !== 'live') {
          return NextResponse.json({ error: 'Question is not live' }, { status: 409 });
        }
        revealQuestion(q.id);
        break;
      }
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 409 });
  }

  broadcast('qa');
  return NextResponse.json({ ok: true });
}
