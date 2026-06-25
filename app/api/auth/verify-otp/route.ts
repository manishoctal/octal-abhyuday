import { NextResponse } from 'next/server';
import { isAdminCode, createSession } from '@/lib/auth';
import { getEmployeeByCode, verifyAndConsumeOtp, upsertUserFromEmployee } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const employeeCode = String(body.employee_code ?? '').trim();
  const otp          = String(body.otp ?? '').trim();

  if (!employeeCode || !otp) {
    return NextResponse.json({ error: 'Employee code and OTP are required.' }, { status: 400 });
  }

  const valid = verifyAndConsumeOtp(employeeCode, otp);
  if (!valid) {
    return NextResponse.json({ error: 'Invalid or expired OTP. Please try again.' }, { status: 401 });
  }

  const employee = getEmployeeByCode(employeeCode);
  if (!employee) {
    return NextResponse.json({ error: 'Employee record not found.' }, { status: 404 });
  }

  const isAdmin = isAdminCode(employeeCode);
  const user = upsertUserFromEmployee(employee);

  await createSession({
    id: user.id,
    email: user.email,
    name: user.name,
    employee_code: employeeCode,
    isAdmin,
  });

  return NextResponse.json({ ok: true, isAdmin });
}
