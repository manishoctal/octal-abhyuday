import { NextResponse } from 'next/server';
import { requireAdmin, isErrorResponse } from '@/lib/api-helpers';
import {
  listFeedbackQuestions, upsertFeedbackQuestion,
  deleteFeedbackQuestion, reorderFeedbackQuestions,
  getSetting, setSetting,
} from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const admin = await requireAdmin();
  if (isErrorResponse(admin)) return admin;
  return NextResponse.json({
    questions: listFeedbackQuestions(false),
    editingAllowed: getSetting('feedback_editing_allowed') === '1',
  });
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (isErrorResponse(admin)) return admin;

  const body = await req.json().catch(() => ({}));

  if (body.action === 'set_editing') {
    setSetting('feedback_editing_allowed', body.value === true || body.value === '1' ? '1' : '0');
    return NextResponse.json({ ok: true });
  }

  if (body.action === 'delete') {
    if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    deleteFeedbackQuestion(Number(body.id));
    return NextResponse.json({ ok: true });
  }

  if (body.action === 'reorder') {
    if (!Array.isArray(body.ids)) return NextResponse.json({ error: 'ids required' }, { status: 400 });
    reorderFeedbackQuestions(body.ids.map(Number));
    return NextResponse.json({ ok: true });
  }

  // create or update
  const { id, title, subtitle, type, options, required, sort_order, active } = body;
  if (!title || !type) return NextResponse.json({ error: 'title and type required' }, { status: 400 });
  const newId = upsertFeedbackQuestion({ id, title, subtitle, type, options, required, sort_order, active });
  return NextResponse.json({ ok: true, id: newId });
}
