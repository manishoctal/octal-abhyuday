import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getEmployeeByEmail, getRoomForEmployee } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const emp = getEmployeeByEmail(session.email);
  if (!emp) return NextResponse.json({ room: null });

  const room = getRoomForEmployee(emp.id);
  return NextResponse.json({ room });
}
