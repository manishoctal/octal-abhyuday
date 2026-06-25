import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getAllFaceEmbeddings, addPhotoTag, getPhotoById } from '@/lib/db';

const FACE_SERVICE = process.env.FACE_SERVICE_URL ?? 'http://localhost:8001';
const THRESHOLD = 0.50;

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { photo_id } = await req.json().catch(() => ({}));
  if (!photo_id) return NextResponse.json({ error: 'photo_id required' }, { status: 400 });

  const photo = getPhotoById(photo_id);
  if (!photo) return NextResponse.json({ error: 'Photo not found' }, { status: 404 });

  const allEmbeddings = getAllFaceEmbeddings();
  if (allEmbeddings.length === 0) {
    return NextResponse.json({ ok: true, tagged: 0, message: 'No employee faces registered yet' });
  }

  // Get all face embeddings from the photo (group photos have multiple faces)
  let embedRes: { embeddings: number[][]; face_count: number };
  try {
    const res = await fetch(`${FACE_SERVICE}/embed-all/url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: photo.url }),
    });
    if (!res.ok) throw new Error(`face-service ${res.status}`);
    embedRes = await res.json();
  } catch (e) {
    return NextResponse.json({ error: `Face service unavailable: ${e}` }, { status: 503 });
  }

  if (embedRes.face_count === 0) {
    return NextResponse.json({ ok: true, tagged: 0, message: 'No faces detected in photo' });
  }

  // For each detected face, find best matching employee
  let tagged = 0;
  for (const faceVec of embedRes.embeddings) {
    const best = bestMatch(faceVec, allEmbeddings, THRESHOLD);
    if (best) {
      addPhotoTag(photo_id, best.employee_id, best.similarity);
      tagged++;
    }
  }

  return NextResponse.json({ ok: true, tagged, faces_detected: embedRes.face_count });
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
