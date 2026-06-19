import { NextResponse } from 'next/server';
import { requireUser, isErrorResponse } from '@/lib/api-helpers';
import { getAppState } from '@/lib/db';
import {
  getAnswerCount,
  getLatestEndedSession,
  getLeaderboard,
  getLiveSession,
  getMyAnswer,
  getQuestion,
  getResults,
} from '@/lib/qa';
import type { QaQuestion, QaSession } from '@/lib/types';

export const dynamic = 'force-dynamic';

function questionPayload(question: QaQuestion, revealed: boolean) {
  return {
    id: question.id,
    type: question.type,
    prompt: question.prompt,
    options: question.options,
    state: question.state,
    correct_option: revealed ? question.correct_option : null,
  };
}

function sessionPayload(s: QaSession) {
  return { id: s.id, title: s.title, status: s.status, kind: s.kind };
}

export async function GET() {
  const session = await requireUser();
  if (isErrorResponse(session)) return session;

  const appState = getAppState();
  const common = { votingState: appState.voting_state, eventName: appState.event_name };
  const live = getLiveSession();

  if (!live) {
    // Nothing live — show the latest ended session's final state, if any
    const ended = getLatestEndedSession();
    const question = ended?.active_question_id ? getQuestion(ended.active_question_id) : undefined;
    return NextResponse.json({
      session: ended ? sessionPayload(ended) : null,
      question: question ? questionPayload(question, true) : null,
      myAnswer: question
        ? (() => {
            const mine = getMyAnswer(question.id, session.id);
            return mine ? { value: mine.value, isAnonymous: !!mine.is_anonymous } : null;
          })()
        : null,
      answerCount: question ? getAnswerCount(question.id) : 0,
      results: question ? getResults(question, session.id) : null,
      leaderboard: ended ? getLeaderboard(ended.id) : undefined,
      ...common,
    });
  }

  const question = live.active_question_id ? getQuestion(live.active_question_id) : undefined;
  if (!question || question.state === 'pending') {
    return NextResponse.json({
      session: sessionPayload(live),
      question: null,
      ...common,
    });
  }

  const revealed = question.state === 'revealed';
  const mine = getMyAnswer(question.id, session.id);

  // Visibility: text answers stream live (so upvoting works). For presented Q&A
  // sessions, MCQ/rating/rank aggregates are hidden until reveal (no bandwagon).
  // For quick polls/rankings, you see live results as soon as you've answered.
  const showAggregates =
    question.type === 'text' || revealed || (live.kind !== 'qna' && !!mine);
  const results = showAggregates ? getResults(question, session.id) : null;

  return NextResponse.json({
    session: sessionPayload(live),
    question: questionPayload(question, revealed),
    myAnswer: mine ? { value: mine.value, isAnonymous: !!mine.is_anonymous } : null,
    answerCount: getAnswerCount(question.id),
    results,
    ...common,
  });
}
