import { NextResponse } from 'next/server';
import { requireAdmin, isErrorResponse } from '@/lib/api-helpers';
import { rootAdminCode } from '@/lib/auth';
import { getDbAdminCodes, addDbAdminCode, removeDbAdminCode, getEmployeeByCode } from '@/lib/db';

export const dynamic = 'force-dynamic';

function isRequesterRootAdmin(session: { employee_code?: string }) {
  return session.employee_code?.trim() === rootAdminCode();
}

function resolveAdmin(code: string) {
  const emp = getEmployeeByCode(code);
  return {
    code,
    name: emp?.name ?? null,
    department: emp?.department ?? null,
  };
}

export async function GET() {
  const session = await requireAdmin();
  if (isErrorResponse(session)) return session;

  const root = rootAdminCode();
  const dbCodes = getDbAdminCodes();

  return NextResponse.json({
    isRootAdmin: isRequesterRootAdmin(session),
    rootAdmin: resolveAdmin(root),
    admins: dbCodes.map(resolveAdmin),
  });
}

export async function POST(req: Request) {
  const session = await requireAdmin();
  if (isErrorResponse(session)) return session;

  if (!isRequesterRootAdmin(session)) {
    return NextResponse.json({ error: 'Only the root admin can add admins' }, { status: 403 });
  }

  const { code } = await req.json().catch(() => ({}));
  if (!code || typeof code !== 'string') {
    return NextResponse.json({ error: 'Employee code required' }, { status: 400 });
  }
  const trimmed = code.trim();
  if (trimmed === rootAdminCode()) {
    return NextResponse.json({ error: 'Root admin is already an admin' }, { status: 409 });
  }

  const emp = getEmployeeByCode(trimmed);
  if (!emp) {
    return NextResponse.json({ error: `No employee found with code "${trimmed}"` }, { status: 404 });
  }

  addDbAdminCode(trimmed);
  return NextResponse.json({ ok: true, admin: resolveAdmin(trimmed) });
}

export async function DELETE(req: Request) {
  const session = await requireAdmin();
  if (isErrorResponse(session)) return session;

  if (!isRequesterRootAdmin(session)) {
    return NextResponse.json({ error: 'Only the root admin can remove admins' }, { status: 403 });
  }

  const { code } = await req.json().catch(() => ({}));
  if (!code || typeof code !== 'string') {
    return NextResponse.json({ error: 'Employee code required' }, { status: 400 });
  }
  if (code.trim() === rootAdminCode()) {
    return NextResponse.json({ error: 'Cannot remove the root admin' }, { status: 409 });
  }

  removeDbAdminCode(code.trim());
  return NextResponse.json({ ok: true });
}
