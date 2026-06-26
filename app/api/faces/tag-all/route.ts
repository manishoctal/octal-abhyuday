import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { listPhotos, getAllFaceEmbeddings, addPhotoTag } from '@/lib/db';

const FACE_SERVICE = process.env.FACE_SERVICE_URL ?? 'http://localhost:8001';
const THRESHOLD = 0.28;

export async function POST() {
  const session = await getSession();
  if (!session?.isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const health = await fetch(`${FACE_SERVICE}/health`, { signal: AbortSignal.timeout(3000) });
    if (!health.ok) throw new Error('unhealthy');
  } catch {
    return NextResponse.json({ error: 'Face service is not running.' }, { status: 503 });
  }

  const allEmbeddings = getAllFaceEmbeddings();
  if (allEmbeddings.length === 0) {
    return NextResponse.json({ error: 'No employee faces registered yet. Run "Register All Faces" first.' }, { status: 422 });
  }

  const photos = listPhotos(true); // approved only
  let tagged = 0, skipped = 0, failed = 0;

  for (const photo of photos) {
    try {
      const res = await fetch(`${FACE_SERVICE}/embed-all/url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: photo.url }),
      });
      if (!res.ok) { failed++; continue; }
      const data: { embeddings: number[][]; face_count: number } = await res.json();
      if (data.face_count === 0) { skipped++; continue; }

      for (const faceVec of data.embeddings) {
        const best = bestMatch(faceVec, allEmbeddings, THRESHOLD);
        if (best) {
          addPhotoTag(photo.id, best.employee_id, best.similarity);
          tagged++;
        }
      }
    } catch {
      failed++;
    }
  }

  return NextResponse.json({ ok: true, photos_processed: photos.length, tags_written: tagged, no_face: skipped, failed });
}

export async function GET() {
  const session = await getSession();
  if (!session?.isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { db } = await import('@/lib/db');
  const tags = (db.prepare('SELECT COUNT(*) as n FROM photo_tags').get() as { n: number }).n;
  const photos = listPhotos(true).length;
  return NextResponse.json({ approved_photos: photos, photo_tags: tags });
}

function bestMatch(
  faceVec: number[],
  candidates: { employee_id: number; embedding: number[] }[],
  threshold: number,
) {
  const fnorm = Math.sqrt(faceVec.reduce((s, x) => s + x * x, 0));
  if (fnorm === 0) return null;
  let best: { employee_id: number; similarity: number } | null = null;
  for (const c of candidates) {
    const cnorm = Math.sqrt(c.embedding.reduce((s, x) => s + x * x, 0));
    if (cnorm === 0) continue;
    const dot = faceVec.reduce((s, x, i) => s + x * c.embedding[i], 0);
    const sim = dot / (fnorm * cnorm);
    if (sim >= threshold && (!best || sim > best.similarity)) {
      best = { employee_id: c.employee_id, similarity: Math.round(sim * 10000) / 10000 };
    }
  }
  return best;
}
