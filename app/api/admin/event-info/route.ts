import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-helpers';
import { listEventInfo, upsertEventInfo, deleteEventInfo } from '@/lib/db';
import { broadcast } from '@/lib/events';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const err = await requireAdmin();
  if (err) return err;
  return NextResponse.json({ items: listEventInfo() });
}

export async function POST(req: Request) {
  const err = await requireAdmin();
  if (err) return err;
  const { action, id, section, title, body, sortOrder } = await req.json();

  if (action === 'delete' && id) {
    deleteEventInfo(id);
    broadcast('state');
    return NextResponse.json({ ok: true });
  }
  if (action === 'upsert') {
    upsertEventInfo(id ?? null, section, title, body, sortOrder ?? 0);
    broadcast('state');
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
