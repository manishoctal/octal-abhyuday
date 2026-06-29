import { NextResponse } from 'next/server';
import { requireAdmin, isErrorResponse } from '@/lib/api-helpers';
import { createRoom, deleteRoom, listRoomsWithOccupants } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const a = await requireAdmin();
  if (isErrorResponse(a)) return a;
  return NextResponse.json({ rooms: listRoomsWithOccupants() });
}

export async function POST(req: Request) {
  const a = await requireAdmin();
  if (isErrorResponse(a)) return a;
  const { room_number, notes } = await req.json().catch(() => ({}));
  if (!room_number?.trim()) return NextResponse.json({ error: 'room_number required' }, { status: 400 });
  try {
    const room = createRoom(room_number, notes);
    return NextResponse.json({ room });
  } catch {
    return NextResponse.json({ error: 'Room number already exists' }, { status: 409 });
  }
}

export async function DELETE(req: Request) {
  const a = await requireAdmin();
  if (isErrorResponse(a)) return a;
  const { id } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  deleteRoom(Number(id));
  return NextResponse.json({ ok: true });
}
