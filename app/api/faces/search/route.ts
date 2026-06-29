import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getAllFaceEmbeddings, getPhotosWithConfidenceByEmployeeId, listEmployees } from '@/lib/db';

export const dynamic = 'force-dynamic';

const FACE_SERVICE = process.env.FACE_SERVICE_URL ?? 'http://localhost:8001';

// buffalo_l (ArcFace) similarity guide:
//   > 0.28 = likely same person
//   > 0.40 = strong match
//   0.05–0.18 = different people
// EMPLOYEE_THRESHOLD: min cosine similarity to identify someone as a matching employee.
// PHOTO_MIN_CONFIDENCE: min tag confidence a gallery photo must have been tagged at.
//   Filters out "best-of-noise" tags where no one in the photo really looked like the employee.
// COMBINED_FLOOR: geometric mean of (employee_sim × photo_confidence) must exceed this.
//   Cuts photos that weakly pass both filters but aren't actually a good match overall.
const EMPLOYEE_THRESHOLD  = 0.28;
const PHOTO_MIN_CONFIDENCE = 0.30;
const COMBINED_FLOOR       = 0.32;

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Expected multipart/form-data with photo field' }, { status: 400 });
  }

  const photo = formData.get('photo') as File | null;
  if (!photo) return NextResponse.json({ error: 'photo field required' }, { status: 400 });

  // Check face service
  try {
    await fetch(`${FACE_SERVICE}/health`, { signal: AbortSignal.timeout(3000) });
  } catch {
    return NextResponse.json({ error: 'Face service is not running.' }, { status: 503 });
  }

  const allEmbeddings = getAllFaceEmbeddings();
  if (allEmbeddings.length === 0) {
    return NextResponse.json({ error: 'No employee faces indexed yet. Run "Index Faces" first.' }, { status: 422 });
  }

  // Get embedding(s) from the uploaded photo (may have multiple faces)
  const uploadForm = new FormData();
  uploadForm.append('file', photo);

  let embedRes: { embeddings: number[][]; face_count: number } | null = null;

  // Try embed-all/upload first; fall back to embed/upload for single face
  try {
    const res = await fetch(`${FACE_SERVICE}/embed-all/upload`, { method: 'POST', body: uploadForm });
    if (res.ok) embedRes = await res.json();
  } catch { /* ignore */ }

  if (!embedRes) {
    const uploadForm2 = new FormData();
    uploadForm2.append('file', photo);
    try {
      const res = await fetch(`${FACE_SERVICE}/embed/upload`, { method: 'POST', body: uploadForm2 });
      if (res.ok) {
        const d: { embedding: number[]; face_found: boolean } = await res.json();
        embedRes = d.face_found ? { embeddings: [d.embedding], face_count: 1 } : { embeddings: [], face_count: 0 };
      }
    } catch {
      return NextResponse.json({ error: 'Face service error' }, { status: 503 });
    }
  }

  if (!embedRes || embedRes.face_count === 0) {
    return NextResponse.json({
      ok: false,
      error: 'No face detected in the uploaded photo. Use a clear, well-lit photo.',
      faces_detected: 0,
    }, { status: 422 });
  }

  // Find matching employees for each detected face
  const employees = listEmployees();
  const empMap = Object.fromEntries(employees.map(e => [e.id, e]));

  const allMatches: Array<{
    employee_id: number;
    name: string;
    employee_code: string;
    profile_photo_url: string | null;
    similarity: number;
  }> = [];
  const seenEmployees = new Set<number>();

  for (const faceVec of embedRes.embeddings) {
    const matches = cosineSimilaritySearch(faceVec, allEmbeddings, EMPLOYEE_THRESHOLD);
    for (const m of matches) {
      if (!seenEmployees.has(m.employee_id)) {
        seenEmployees.add(m.employee_id);
        const emp = empMap[m.employee_id];
        if (emp) {
          allMatches.push({
            employee_id: m.employee_id,
            name: emp.name,
            employee_code: emp.employee_code,
            profile_photo_url: emp.profile_photo_url ?? null,
            similarity: m.similarity,
          });
        }
      }
    }
  }

  allMatches.sort((a, b) => b.similarity - a.similarity);

  // Collect gallery photos, filtering by tag confidence and computing a combined score.
  // combined_score = geometric mean of (employee_similarity × photo_tag_confidence).
  // This penalises cases where either signal is weak — photos only surface when BOTH
  // the uploaded face strongly matches the employee AND the gallery photo was confidently
  // tagged to that employee during the indexing step.
  const seenPhotoIds = new Set<number>();
  const photos: Array<{
    id: number; url: string; thumbnail_url: string | null; caption: string | null;
    uploader_name: string; tag_confidence: number; match_score: number; matched_employee_id: number;
  }> = [];

  for (const m of allMatches) {
    const empPhotos = getPhotosWithConfidenceByEmployeeId(m.employee_id, PHOTO_MIN_CONFIDENCE);
    for (const p of empPhotos) {
      if (seenPhotoIds.has(p.id)) continue;
      const combined = Math.sqrt(m.similarity * p.tag_confidence);
      if (combined < COMBINED_FLOOR) continue;
      seenPhotoIds.add(p.id);
      photos.push({
        id: p.id,
        url: p.url,
        thumbnail_url: p.thumbnail_url,
        caption: p.caption,
        uploader_name: p.uploader_name,
        tag_confidence: p.tag_confidence,
        match_score: Math.round(combined * 10000) / 10000,
        matched_employee_id: m.employee_id,
      });
    }
  }

  photos.sort((a, b) => b.match_score - a.match_score);

  return NextResponse.json({
    ok: true,
    faces_detected: embedRes.face_count,
    total_indexed: allEmbeddings.length,
    matches: allMatches,
    photos,
  });
}

function cosineSimilaritySearch(
  vec: number[],
  candidates: { employee_id: number; embedding: number[] }[],
  threshold: number,
) {
  const vnorm = Math.sqrt(vec.reduce((s, x) => s + x * x, 0));
  if (vnorm === 0) return [];

  return candidates
    .map(c => {
      const cnorm = Math.sqrt(c.embedding.reduce((s, x) => s + x * x, 0));
      if (cnorm === 0) return null;
      const dot = vec.reduce((s, x, i) => s + x * c.embedding[i], 0);
      const sim = dot / (vnorm * cnorm);
      return sim >= threshold ? { employee_id: c.employee_id, similarity: Math.round(sim * 10000) / 10000 } : null;
    })
    .filter((m): m is { employee_id: number; similarity: number } => m !== null)
    .sort((a, b) => b.similarity - a.similarity);
}
