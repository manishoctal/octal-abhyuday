import { NextResponse } from 'next/server';
import { requireAdmin, isErrorResponse } from '@/lib/api-helpers';
import { listEventInfo, upsertEventInfo, deleteEventInfo, reorderEventInfo } from '@/lib/db';
import { broadcast } from '@/lib/events';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const err = await requireAdmin();
  if (isErrorResponse(err)) return err;
  return NextResponse.json({ items: listEventInfo() });
}

export async function POST(req: Request) {
  const err = await requireAdmin();
  if (isErrorResponse(err)) return err;
  const parsed = await req.json();
  const { action, id, section, title, body, sortOrder, mapsUrl, ids } = parsed;

  if (action === 'reorder') {
    if (!Array.isArray(ids)) return NextResponse.json({ error: 'ids required' }, { status: 400 });
    reorderEventInfo(ids);
    return NextResponse.json({ ok: true });
  }
  if (action === 'delete' && id) {
    deleteEventInfo(id);
    broadcast('state');
    return NextResponse.json({ ok: true });
  }
  if (action === 'upsert') {
    upsertEventInfo(id ?? null, section, title, body, sortOrder ?? 0, mapsUrl ?? null);
    broadcast('state');
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
