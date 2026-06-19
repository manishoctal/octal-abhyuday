import { NextResponse } from 'next/server';
import { requireAdmin, isErrorResponse } from '@/lib/api-helpers';
import { createQaSession, deleteQaSession, getQaSession, listSessions } from '@/lib/qa';
import { broadcast } from '@/lib/events';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await requireAdmin();
  if (isErrorResponse(session)) return session;
  return NextResponse.json({ sessions: listSessions() });
}

export async function POST(req: Request) {
  const session = await requireAdmin();
  if (isErrorResponse(session)) return session;

  const { title } = await req.json().catch(() => ({}));
  if (typeof title !== 'string' || !title.trim() || title.trim().length > 80) {
    return NextResponse.json({ error: 'Title must be 1–80 characters' }, { status: 400 });
  }
  const created = createQaSession(title.trim());
  return NextResponse.json({ ok: true, session: created });
}

export async function DELETE(req: Request) {
  const session = await requireAdmin();
  if (isErrorResponse(session)) return session;

  const { id } = await req.json().catch(() => ({}));
  const target = typeof id === 'number' ? getQaSession(id) : undefined;
  if (!target) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

  deleteQaSession(target.id);
  broadcast('qa');
  return NextResponse.json({ ok: true });
}
