import { NextResponse } from 'next/server';
import { requireUser, isErrorResponse } from '@/lib/api-helpers';
import { toggleUpvote } from '@/lib/qa';
import { db } from '@/lib/db';
import { broadcast } from '@/lib/events';

export async function POST(req: Request) {
  const session = await requireUser();
  if (isErrorResponse(session)) return session;

  const { answerId } = await req.json().catch(() => ({}));
  if (typeof answerId !== 'number') {
    return NextResponse.json({ error: 'answerId required' }, { status: 400 });
  }
  const answer = db.prepare('SELECT id FROM qa_answers WHERE id = ?').get(answerId);
  if (!answer) return NextResponse.json({ error: 'Answer not found' }, { status: 404 });

  const upvoted = toggleUpvote(answerId, session.id);
  broadcast('qa');
  return NextResponse.json({ ok: true, upvoted });
}
