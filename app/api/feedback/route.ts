import { NextResponse } from 'next/server';
import { requireUser, requireAdmin, isErrorResponse } from '@/lib/api-helpers';
import {
  getFeedbackSubmission, upsertFeedbackSubmission,
  listFeedbackSubmissions, listFeedbackQuestions,
} from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);

  if (url.searchParams.get('admin') === '1') {
    const admin = await requireAdmin();
    if (isErrorResponse(admin)) return admin;
    return NextResponse.json({
      submissions: listFeedbackSubmissions(),
      questions:   listFeedbackQuestions(false),
    });
  }

  const user = await requireUser();
  if (isErrorResponse(user)) return user;
  return NextResponse.json({ submission: getFeedbackSubmission(user.id) ?? null });
}

export async function POST(req: Request) {
  const user = await requireUser();
  if (isErrorResponse(user)) return user;

  if (getFeedbackSubmission(user.id)) {
    return NextResponse.json({ error: 'Feedback already submitted and cannot be changed.' }, { status: 409 });
  }

  const { answers } = await req.json().catch(() => ({}));
  if (!answers || typeof answers !== 'object') {
    return NextResponse.json({ error: 'answers object required' }, { status: 400 });
  }

  upsertFeedbackSubmission(user.id, answers);
  return NextResponse.json({ ok: true });
}
