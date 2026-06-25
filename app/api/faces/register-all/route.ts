import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { listEmployees, saveFaceEmbedding } from '@/lib/db';

const FACE_SERVICE = process.env.FACE_SERVICE_URL ?? 'http://localhost:8001';

export async function POST() {
  const session = await getSession();
  if (!session?.isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Check face service is up
  try {
    const health = await fetch(`${FACE_SERVICE}/health`, { signal: AbortSignal.timeout(3000) });
    if (!health.ok) throw new Error('unhealthy');
  } catch {
    return NextResponse.json({ error: 'Face service is not running. Start it with: uvicorn main:app --host 127.0.0.1 --port 8001' }, { status: 503 });
  }

  const employees = listEmployees().filter(e => e.profile_photo_url);
  let registered = 0, skipped = 0, failed = 0;

  for (const emp of employees) {
    try {
      const res = await fetch(`${FACE_SERVICE}/embed/url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: emp.profile_photo_url }),
      });
      if (!res.ok) { failed++; continue; }
      const data = await res.json();
      if (!data.face_found) { skipped++; continue; }
      saveFaceEmbedding(emp.id, data.embedding);
      registered++;
    } catch {
      failed++;
    }
  }

  return NextResponse.json({ ok: true, total: employees.length, registered, skipped, failed });
}

export async function GET() {
  const session = await getSession();
  if (!session?.isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { getAllFaceEmbeddings, listEmployees: le } = await import('@/lib/db');
  const total = le().filter(e => e.profile_photo_url).length;
  const registered = getAllFaceEmbeddings().length;
  return NextResponse.json({ total_with_photo: total, registered });
}
