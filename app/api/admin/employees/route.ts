import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  listEmployeesWithFaceStatus, createEmployee, updateEmployee, deleteEmployee,
  getEmployeeByCode, getEmployeeByEmail,
} from '@/lib/db';

const FACE_SERVICE = process.env.FACE_SERVICE_URL ?? 'http://localhost:8001';

async function isFaceServiceUp(): Promise<boolean> {
  try {
    const res = await fetch(`${FACE_SERVICE}/health`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch { return false; }
}

export async function GET() {
  const session = await getSession();
  if (!session?.isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({ employees: listEmployeesWithFaceStatus() });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { action } = body;

  if (action === 'create') {
    const { employee_code, name, email, department, gender, profile_photo_url } = body;
    if (!employee_code?.trim()) return NextResponse.json({ error: 'Employee code is required.' }, { status: 400 });
    if (!name?.trim())          return NextResponse.json({ error: 'Name is required.' }, { status: 400 });
    if (!email?.trim())         return NextResponse.json({ error: 'Email is required.' }, { status: 400 });

    if (getEmployeeByCode(employee_code.trim())) {
      return NextResponse.json({ error: `Employee code "${employee_code}" already exists.` }, { status: 409 });
    }
    if (getEmployeeByEmail(email.trim())) {
      return NextResponse.json({ error: `Email "${email}" is already registered.` }, { status: 409 });
    }

    const emp = createEmployee(
      employee_code.trim(), name.trim(), email.trim(),
      department?.trim() || null,
      gender === 'male' || gender === 'female' ? gender : null,
      profile_photo_url?.trim() || null,
    );

    // Auto-register face if photo provided and face service is running
    let faceRegistered = false;
    if (emp.profile_photo_url && await isFaceServiceUp()) {
      try {
        const fr = await fetch(`${process.env.NEXTAUTH_URL ?? 'http://localhost:3000'}/api/faces/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Cookie: req.headers.get('Cookie') ?? '' },
          body: JSON.stringify({ employee_id: emp.id }),
        });
        faceRegistered = fr.ok;
      } catch { /* face service offline — not critical */ }
    }

    return NextResponse.json({ ok: true, employee: emp, faceRegistered });
  }

  if (action === 'update') {
    const { id, employee_code, name, email, department, gender, profile_photo_url, is_active, exclude_from_voting } = body;
    if (!id) return NextResponse.json({ error: 'ID required.' }, { status: 400 });

    // Check uniqueness for code + email (excluding self)
    const byCode = getEmployeeByCode(employee_code?.trim() ?? '');
    if (byCode && byCode.id !== id) {
      return NextResponse.json({ error: `Employee code "${employee_code}" already in use.` }, { status: 409 });
    }
    const byEmail = getEmployeeByEmail(email?.trim() ?? '');
    if (byEmail && byEmail.id !== id) {
      return NextResponse.json({ error: `Email "${email}" already in use.` }, { status: 409 });
    }

    updateEmployee(
      id, employee_code?.trim(), name?.trim(), email?.trim(),
      department?.trim() || null,
      gender === 'male' || gender === 'female' ? gender : null,
      profile_photo_url?.trim() || null,
      is_active === false || is_active === 0 ? 0 : 1,
      exclude_from_voting ? 1 : 0,
    );

    // Re-register face if photo changed and face service is running
    let faceRegistered = false;
    if (profile_photo_url?.trim() && await isFaceServiceUp()) {
      try {
        const fr = await fetch(`${process.env.NEXTAUTH_URL ?? 'http://localhost:3000'}/api/faces/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Cookie: req.headers.get('Cookie') ?? '' },
          body: JSON.stringify({ employee_id: id }),
        });
        faceRegistered = fr.ok;
      } catch { /* face service offline — not critical */ }
    }

    return NextResponse.json({ ok: true, faceRegistered });
  }

  if (action === 'delete') {
    const { id } = body;
    if (!id) return NextResponse.json({ error: 'ID required.' }, { status: 400 });
    deleteEmployee(id);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
}
