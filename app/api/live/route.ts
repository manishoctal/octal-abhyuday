import { NextResponse } from 'next/server';
import { requireUser, isErrorResponse } from '@/lib/api-helpers';
import { getAppState } from '@/lib/db';
import { getLiveSession, getQuestion } from '@/lib/qa';

export const dynamic = 'force-dynamic';

export async function GET() {
  const userOrErr = await requireUser();
  if (isErrorResponse(userOrErr)) return userOrErr;

  const appState = getAppState();
  const liveQa   = getLiveSession();
  const liveQ    = liveQa?.active_question_id ? getQuestion(liveQa.active_question_id) : null;

  return NextResponse.json({
    votingLive: appState.voting_state === 'live',
    votingPaused: appState.voting_state === 'paused',
    liveQa: liveQa
      ? {
          id: liveQa.id,
          title: liveQa.title,
          kind: liveQa.kind,
          activeQuestion: liveQ ? liveQ.prompt : null,
        }
      : null,
  });
}
