import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const COOKIE_NAME = 'octal_vote_session';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(COOKIE_NAME)?.value;

  let session: { email?: string } | null = null;
  if (token) {
    try {
      const secret = new TextEncoder().encode(process.env.JWT_SECRET ?? 'octal-vote-dev-secret');
      const { payload } = await jwtVerify(token, secret);
      session = payload as { email?: string };
    } catch {
      session = null;
    }
  }

  if (pathname === '/login') {
    if (session) return NextResponse.redirect(new URL('/', req.url));
    return NextResponse.next();
  }

  if (!session) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/login', '/voting-results', '/qna', '/stage', '/admin/:path*'],
};
