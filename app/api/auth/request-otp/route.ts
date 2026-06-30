import { NextResponse } from 'next/server';
import { getEmployeeByCode, saveOtp, getAppState, getSetting } from '@/lib/db';
import { sendOtpEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

function generateRealOtp(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export async function POST(req: Request) {
  try {
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

    const otpEmailEnabled = getSetting('otp_email_enabled') === '1';
    const { event_name } = getAppState();

    if (otpEmailEnabled) {
      const code = generateRealOtp();
      saveOtp(employeeCode, code);
      let sent = false;
      try {
        sent = await sendOtpEmail(employee.email, code, event_name);
      } catch (emailErr) {
        const msg = emailErr instanceof Error ? emailErr.message : String(emailErr);
        console.error('[request-otp] sendOtpEmail threw:', msg);
        return NextResponse.json(
          { error: `Failed to send email: ${msg}` },
          { status: 503 },
        );
      }
      if (!sent) {
        return NextResponse.json(
          { error: 'Email service is not configured. Ask your administrator to set up SMTP or disable email OTP.' },
          { status: 503 },
        );
      }
      return NextResponse.json({ ok: true, message: 'OTP sent to your registered email.' });
    }

    // Static OTP mode: use env var or default
    const code = process.env.OTP_CODE ?? '1234';
    saveOtp(employeeCode, code);
    return NextResponse.json({ ok: true, message: 'Enter your event code to sign in.' });
  } catch (err) {
    console.error('[request-otp]', err);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
