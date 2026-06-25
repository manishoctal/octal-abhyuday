import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getEmployeeById, saveFaceEmbedding } from '@/lib/db';

const FACE_SERVICE = process.env.FACE_SERVICE_URL ?? 'http://localhost:8001';

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { employee_id } = await req.json().catch(() => ({}));
  if (!employee_id) return NextResponse.json({ error: 'employee_id required' }, { status: 400 });

  const emp = getEmployeeById(employee_id);
  if (!emp) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
  if (!emp.profile_photo_url) return NextResponse.json({ error: 'Employee has no photo' }, { status: 422 });

  let data: { embedding: number[]; face_found: boolean };
  try {
    const res = await fetch(`${FACE_SERVICE}/embed/url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: emp.profile_photo_url }),
    });
    if (!res.ok) throw new Error(`face-service ${res.status}`);
    data = await res.json();
  } catch (e) {
    return NextResponse.json({ error: `Face service unavailable: ${e}` }, { status: 503 });
  }

  if (!data.face_found) {
    return NextResponse.json({ ok: false, error: 'No face detected in employee photo' }, { status: 422 });
  }

  saveFaceEmbedding(employee_id, data.embedding);
  return NextResponse.json({ ok: true });
}
