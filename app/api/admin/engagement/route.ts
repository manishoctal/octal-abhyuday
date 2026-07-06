import { NextResponse } from 'next/server';
import { requireAdmin, isErrorResponse } from '@/lib/api-helpers';
import { listEmployeeEngagement } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const admin = await requireAdmin();
    if (isErrorResponse(admin)) return admin;
    return NextResponse.json({ rows: listEmployeeEngagement() });
  } catch (e) {
    console.error('[engagement]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
