import { NextResponse } from 'next/server';
import { isValidEmail, allowedDomain } from '@/lib/auth';

export async function POST(req: Request) {
  const { email } = await req.json().catch(() => ({}));
  if (typeof email !== 'string' || !isValidEmail(email)) {
    return NextResponse.json(
      { error: `Please use your official @${allowedDomain()} email` },
      { status: 400 }
    );
  }
  // OTP delivery is stubbed for now — the code is fixed via OTP_CODE env.
  return NextResponse.json({ ok: true, message: 'OTP sent to your email' });
}
