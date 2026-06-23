import { NextResponse } from 'next/server';
import { requireAdmin, requireUser, isErrorResponse } from '@/lib/api-helpers';
import { checkIn, getAttendance, listAttendance } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get('list') === '1') {
    const adminOrErr = await requireAdmin();
    if (isErrorResponse(adminOrErr)) return adminOrErr;
    const rows = listAttendance();
    if (url.searchParams.get('format') === 'csv') {
      const csv = [
        'Name,Email,Department,Checked In At',
        ...rows.map((r) => `"${r.name}","${r.email}","${r.department ?? ''}","${r.checked_in_at}"`),
      ].join('\n');
      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="attendance.csv"',
        },
      });
    }
    return NextResponse.json({ attendance: rows, total: rows.length });
  }
  const userOrErr = await requireUser();
  if (isErrorResponse(userOrErr)) return userOrErr;
  return NextResponse.json({ record: getAttendance(userOrErr.id) });
}

export async function POST(req: Request) {
  const adminOrErr = await requireAdmin();
  if (isErrorResponse(adminOrErr)) return adminOrErr;
  const { userId } = await req.json();
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });
  const result = checkIn(Number(userId));
  return NextResponse.json({ ok: true, alreadyCheckedIn: result.changes === 0 });
}
