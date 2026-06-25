import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  listEmployees, createEmployee, updateEmployee, deleteEmployee,
  getEmployeeByCode, getEmployeeByEmail,
} from '@/lib/db';

export async function GET() {
  const session = await getSession();
  if (!session?.isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({ employees: listEmployees() });
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
    return NextResponse.json({ ok: true, employee: emp });
  }

  if (action === 'update') {
    const { id, employee_code, name, email, department, gender, profile_photo_url, is_active } = body;
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
    );
    return NextResponse.json({ ok: true });
  }

  if (action === 'delete') {
    const { id } = body;
    if (!id) return NextResponse.json({ error: 'ID required.' }, { status: 400 });
    deleteEmployee(id);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
}
