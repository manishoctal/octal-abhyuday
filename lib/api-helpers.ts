import { NextResponse } from 'next/server';
import { getSession } from './auth';
import type { SessionUser } from './types';

export async function requireUser(): Promise<SessionUser | NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }
  return session;
}

export async function requireAdmin(): Promise<SessionUser | NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }
  if (!session.isAdmin) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }
  return session;
}

export function isErrorResponse(v: SessionUser | NextResponse): v is NextResponse {
  return v instanceof NextResponse;
}
