import { NextResponse } from 'next/server';
import { isValidEmail, isAdminEmail, nameFromEmail, createSession, allowedDomain } from '@/lib/auth';
import { upsertUser, ensureEmployeeCandidate } from '@/lib/db';

export async function POST(req: Request) {
  const { email, otp } = await req.json().catch(() => ({}));
  if (typeof email !== 'string' || !isValidEmail(email)) {
    return NextResponse.json(
      { error: `Please use your official @${allowedDomain()} email` },
      { status: 400 }
    );
  }
  if (typeof otp !== 'string' || otp.trim() !== (process.env.OTP_CODE ?? '1234')) {
    return NextResponse.json({ error: 'Invalid OTP. Please try again.' }, { status: 401 });
  }

  const normalized = email.trim().toLowerCase();
  const user = upsertUser(normalized, nameFromEmail(normalized));
  const isAdmin = isAdminEmail(normalized);
  // Every employee who signs in becomes a round-1 candidate (deduped by email);
  // admins are organizers, not candidates
  if (!isAdmin) ensureEmployeeCandidate(normalized, user.name);
  await createSession({ id: user.id, email: user.email, name: user.name, isAdmin });

  return NextResponse.json({ ok: true, isAdmin });
}
