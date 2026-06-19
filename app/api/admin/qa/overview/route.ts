import { NextResponse } from 'next/server';
import { requireAdmin, isErrorResponse } from '@/lib/api-helpers';
import { getAppState } from '@/lib/db';
import {
  getAnswerCount,
  getLatestEndedSession,
  getLeaderboard,
  getLiveSession,
  getQuestion,
  getResults,
} from '@/lib/qa';

export const dynamic = 'force-dynamic';

/** Full live picture for the presenter (admin module + stage view): includes
 *  live MCQ counts and the correct answer even before reveal. */
export async function GET() {
  const session = await requireAdmin();
  if (isErrorResponse(session)) return session;

  const appState = getAppState();
  const live = getLiveSession();
  const ended = live ? null : (getLatestEndedSession() ?? null);
  const target = live ?? ended;

  // For an ended session, keep showing its last question's final results
  const question = target?.active_question_id ? getQuestion(target.active_question_id) : undefined;

  return NextResponse.json({
    eventName: appState.event_name,
    session: target
      ? { id: target.id, title: target.title, status: target.status, kind: target.kind }
      : null,
    question:
      question && question.state !== 'pending'
        ? {
            id: question.id,
            type: question.type,
            prompt: question.prompt,
            options: question.options,
            state: question.state,
            correct_option: question.correct_option,
          }
        : null,
    answerCount: question && question.state !== 'pending' ? getAnswerCount(question.id) : 0,
    results:
      question && question.state !== 'pending' ? getResults(question, session.id) : null,
    leaderboard: target ? getLeaderboard(target.id, 5) : [],
  });
}
