import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getAllFaceEmbeddings, getPhotosByEmployeeId } from '@/lib/db';

const FACE_SERVICE = process.env.FACE_SERVICE_URL ?? 'http://localhost:8001';

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Expected multipart/form-data with selfie field' }, { status: 400 });
  }

  const selfie = formData.get('selfie') as File | null;
  if (!selfie) return NextResponse.json({ error: 'selfie field required' }, { status: 400 });

  const allEmbeddings = getAllFaceEmbeddings();
  if (allEmbeddings.length === 0) {
    return NextResponse.json({ ok: false, error: 'No faces registered yet. Ask admin to register employee faces.' }, { status: 422 });
  }

  // Step 1: get selfie embedding from face service
  const uploadForm = new FormData();
  uploadForm.append('file', selfie);

  let embedRes: { embedding: number[]; face_found: boolean };
  try {
    const res = await fetch(`${FACE_SERVICE}/embed/upload`, {
      method: 'POST',
      body: uploadForm,
    });
    if (!res.ok) throw new Error(`face-service returned ${res.status}`);
    embedRes = await res.json();
  } catch (e) {
    return NextResponse.json({ error: `Face service unavailable: ${e}` }, { status: 503 });
  }

  if (!embedRes.face_found) {
    return NextResponse.json({
      ok: false,
      error: 'No face detected in selfie. Use better lighting and face the camera directly.',
    }, { status: 422 });
  }

  // Step 2: cosine similarity in Node — 108 employees × 512 floats is ~1ms
  const matches = cosineSimilaritySearch(embedRes.embedding, allEmbeddings, 0.28);

  if (!matches.length) {
    return NextResponse.json({ ok: true, photos: [], message: 'No matching photos found. Make sure your profile photo is registered.' });
  }

  // Step 3: fetch gallery photos tagged with matched employees
  const seen = new Set<number>();
  const photos = matches
    .flatMap(m => getPhotosByEmployeeId(m.employee_id))
    .filter(p => { if (seen.has(p.id)) return false; seen.add(p.id); return true; });

  return NextResponse.json({ ok: true, photos, matches });
}

function cosineSimilaritySearch(
  selfieVec: number[],
  candidates: { employee_id: number; embedding: number[] }[],
  threshold: number,
) {
  const snorm = Math.sqrt(selfieVec.reduce((s, x) => s + x * x, 0));
  if (snorm === 0) return [];

  return candidates
    .map(c => {
      const cv = c.embedding;
      const cnorm = Math.sqrt(cv.reduce((s, x) => s + x * x, 0));
      if (cnorm === 0) return null;
      const dot = selfieVec.reduce((s, x, i) => s + x * cv[i], 0);
      const sim = dot / (snorm * cnorm);
      return sim >= threshold ? { employee_id: c.employee_id, similarity: Math.round(sim * 10000) / 10000 } : null;
    })
    .filter((m): m is { employee_id: number; similarity: number } => m !== null)
    .sort((a, b) => b.similarity - a.similarity);
}
