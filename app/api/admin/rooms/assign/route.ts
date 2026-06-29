import { NextResponse } from 'next/server';
import { requireAdmin, isErrorResponse } from '@/lib/api-helpers';
import { assignToRoom, removeFromRoom } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const a = await requireAdmin();
  if (isErrorResponse(a)) return a;
  const { room_id, employee_id } = await req.json().catch(() => ({}));
  if (!room_id || !employee_id) return NextResponse.json({ error: 'room_id and employee_id required' }, { status: 400 });
  assignToRoom(Number(room_id), Number(employee_id));
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const a = await requireAdmin();
  if (isErrorResponse(a)) return a;
  const { employee_id } = await req.json().catch(() => ({}));
  if (!employee_id) return NextResponse.json({ error: 'employee_id required' }, { status: 400 });
  removeFromRoom(Number(employee_id));
  return NextResponse.json({ ok: true });
}
