import { NextResponse } from 'next/server';
import { requireAdmin, isErrorResponse } from '@/lib/api-helpers';
import { listEmployeeEngagement } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const admin = await requireAdmin();
  if (isErrorResponse(admin)) return admin;
  return NextResponse.json({ rows: listEmployeeEngagement() });
}
