import { NextResponse } from 'next/server';
import { requireAdmin, isErrorResponse } from '@/lib/api-helpers';
import { listAllUsers } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const adminOrErr = await requireAdmin();
  if (isErrorResponse(adminOrErr)) return adminOrErr;
  return NextResponse.json({ users: listAllUsers() });
}
