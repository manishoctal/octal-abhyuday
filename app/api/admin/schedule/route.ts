import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-helpers';
import {
  listScheduleSessions,
  createScheduleSession,
  updateScheduleSession,
  deleteScheduleSession,
} from '@/lib/db';
import { broadcast } from '@/lib/events';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const err = await requireAdmin();
  if (err) return err;
  return NextResponse.json({ sessions: listScheduleSessions() });
}

export async function POST(req: Request) {
  const err = await requireAdmin();
  if (err) return err;
  const body = await req.json();
  const { action, id, data } = body as {
    action: 'create' | 'update' | 'delete';
    id?: number;
    data?: Record<string, unknown>;
  };

  if (action === 'delete' && id) {
    deleteScheduleSession(id);
    broadcast('state');
    return NextResponse.json({ ok: true });
  }
  if (action === 'create' && data) {
    const s = createScheduleSession({
      title: String(data.title ?? ''),
      start_time: String(data.start_time ?? ''),
      end_time: data.end_time ? String(data.end_time) : null,
      location: data.location ? String(data.location) : null,
      speaker: data.speaker ? String(data.speaker) : null,
      type: (data.type as 'session') ?? 'session',
      description: data.description ? String(data.description) : null,
      sort_order: Number(data.sort_order ?? 0),
    });
    broadcast('state');
    return NextResponse.json({ session: s });
  }
  if (action === 'update' && id && data) {
    updateScheduleSession(id, {
      title: String(data.title ?? ''),
      start_time: String(data.start_time ?? ''),
      end_time: data.end_time ? String(data.end_time) : null,
      location: data.location ? String(data.location) : null,
      speaker: data.speaker ? String(data.speaker) : null,
      type: (data.type as 'session') ?? 'session',
      description: data.description ? String(data.description) : null,
      sort_order: Number(data.sort_order ?? 0),
    });
    broadcast('state');
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
