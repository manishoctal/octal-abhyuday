import { NextResponse } from 'next/server';
import { isAdminCode } from '@/lib/auth';
import { getEmployeeByCode, saveOtp, getAppState } from '@/lib/db';
import { sendOtpEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

function generateOtp(): string {
  if (process.env.OTP_CODE) return process.env.OTP_CODE;
  return String(Math.floor(1000 + Math.random() * 9000));
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const employeeCode = String(body.employee_code ?? '').trim();

  if (!employeeCode) {
    return NextResponse.json({ error: 'Please enter your employee code.' }, { status: 400 });
  }

  const employee = getEmployeeByCode(employeeCode);

  if (!employee) {
    return NextResponse.json(
      { error: 'Employee code not found. Contact your administrator.' },
      { status: 404 },
    );
  }

  if (!employee.is_active) {
    return NextResponse.json(
      { error: 'Your account is inactive. Contact your administrator.' },
      { status: 403 },
    );
  }

  const code = generateOtp();
  // Key OTP by employee_code (reuse the otp_codes table; the "email" column is just a unique key)
  saveOtp(employeeCode, code);
  const { event_name } = getAppState();
  await sendOtpEmail(employee.email, code, event_name);

  return NextResponse.json({ ok: true, message: 'OTP sent to your registered email.' });
}
