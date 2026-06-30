import { NextResponse } from 'next/server';
import { requireAdmin, isErrorResponse } from '@/lib/api-helpers';
import { syncAllCandidatePhotos } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST() {
  const a = await requireAdmin();
  if (isErrorResponse(a)) return a;
  const updated = syncAllCandidatePhotos();
  return NextResponse.json({ ok: true, updated });
}
