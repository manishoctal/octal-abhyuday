import { NextResponse } from 'next/server';
import { requireUser, isErrorResponse } from '@/lib/api-helpers';
import { getLeaderboard, getUserPoints } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const userOrErr = await requireUser();
  if (isErrorResponse(userOrErr)) return userOrErr;
  const board = getLeaderboard(50);
  const myPoints = getUserPoints(userOrErr.id);
  const myRank = board.findIndex(r => r.user_id === userOrErr.id) + 1;
  return NextResponse.json({ board, myPoints, myRank: myRank || null });
}
