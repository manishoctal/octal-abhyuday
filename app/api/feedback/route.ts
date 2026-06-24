import { NextResponse } from 'next/server';
import { requireUser, requireAdmin, isErrorResponse } from '@/lib/api-helpers';
import { getFeedback, upsertFeedback, listFeedback } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);

  if (url.searchParams.get('admin') === '1') {
    const adminOrErr = await requireAdmin();
    if (isErrorResponse(adminOrErr)) return adminOrErr;
    return NextResponse.json({ feedback: listFeedback() });
  }

  const userOrErr = await requireUser();
  if (isErrorResponse(userOrErr)) return userOrErr;
  const existing = getFeedback(userOrErr.id);
  return NextResponse.json({ feedback: existing ?? null });
}

export async function POST(req: Request) {
  const userOrErr = await requireUser();
  if (isErrorResponse(userOrErr)) return userOrErr;

  const { overall_rating, session_ratings, food_rating, venue_rating, suggestions } = await req.json();

  if (!overall_rating || overall_rating < 1 || overall_rating > 5) {
    return NextResponse.json({ error: 'overall_rating must be 1–5' }, { status: 400 });
  }

  upsertFeedback(
    userOrErr.id,
    overall_rating,
    session_ratings ?? {},
    food_rating ?? null,
    venue_rating ?? null,
    suggestions ?? null
  );

  return NextResponse.json({ ok: true });
}
