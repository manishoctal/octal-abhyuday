import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import type { SessionUser } from './types';
import { getDbAdminCodes } from './db';

const COOKIE_NAME = 'octal_vote_session';

function secret() {
  return new TextEncoder().encode(process.env.JWT_SECRET ?? 'octal-vote-dev-secret');
}

export function allowedDomain() {
  return (process.env.ALLOWED_EMAIL_DOMAIN ?? 'octalsoftware.com').toLowerCase();
}

export function isValidEmail(email: string) {
  const e = email.trim().toLowerCase();
  return /^[a-z0-9][a-z0-9._%+-]*@[a-z0-9.-]+$/.test(e) && e.endsWith(`@${allowedDomain()}`);
}

/** The one always-admin code set in .env (cannot be removed via UI). */
export function rootAdminCode(): string {
  return (process.env.ROOT_ADMIN_CODE ?? '1423').trim();
}

export function isAdminEmail(email: string) {
  const admins = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(email.trim().toLowerCase());
}

export function isAdminCode(code: string): boolean {
  if (!code) return false;
  const c = code.trim();
  // Root admin (env-configured, cannot be removed)
  if (c === rootAdminCode()) return true;
  // Legacy env-based codes (ADMIN_CODES) — kept for backward compat
  const envCodes = (process.env.ADMIN_CODES ?? '').split(',').map(s => s.trim()).filter(Boolean);
  if (envCodes.includes(c)) return true;
  // DB-managed codes (set via admin UI)
  return getDbAdminCodes().includes(c);
}

export function nameFromEmail(email: string) {
  const local = email.split('@')[0];
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join(' ');
}

export async function createSession(user: SessionUser) {
  const token = await new SignJWT({ ...user })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret());
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  });
}

export async function getSession(): Promise<SessionUser | null> {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return {
      id:            payload.id as number,
      email:         payload.email as string,
      name:          payload.name as string,
      employee_code: payload.employee_code as string | undefined,
      // Re-derive so changes to ADMIN_EMAILS/ADMIN_CODES/DB apply without re-login
      isAdmin: isAdminEmail(payload.email as string) || isAdminCode(payload.employee_code as string ?? ''),
    };
  } catch {
    return null;
  }
}

export function clearSession() {
  cookies().delete(COOKIE_NAME);
}

export { COOKIE_NAME };
