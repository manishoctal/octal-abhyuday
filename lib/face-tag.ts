import { getPhotoById, getAllFaceEmbeddings, addPhotoTag, setPhotoTagStatus } from './db';

const FACE_SERVICE = () => process.env.FACE_SERVICE_URL ?? 'http://localhost:8001';
const THRESHOLD = 0.28;

function cosine(a: number[], b: number[]): number {
  const an = Math.sqrt(a.reduce((s, x) => s + x * x, 0));
  const bn = Math.sqrt(b.reduce((s, x) => s + x * x, 0));
  if (an === 0 || bn === 0) return 0;
  return a.reduce((s, x, i) => s + x * b[i], 0) / (an * bn);
}

function bestMatch(
  vec: number[],
  candidates: { employee_id: number; embedding: number[] }[],
): { employee_id: number; similarity: number } | null {
  let best: { employee_id: number; similarity: number } | null = null;
  for (const c of candidates) {
    const sim = cosine(vec, c.embedding);
    if (sim >= THRESHOLD && (!best || sim > best.similarity)) {
      best = { employee_id: c.employee_id, similarity: Math.round(sim * 10000) / 10000 };
    }
  }
  return best;
}

/**
 * Sends a photo to the face service, matches detected faces against all registered
 * employee embeddings, and writes photo_tags rows to the DB.
 *
 * Safe to call without any HTTP session — purely server-side.
 * `baseUrl` is needed only for local-disk photos (`/uploads/...`) so the face
 * service can fetch them; S3/CDN photos use their own absolute URL.
 */
export async function tagPhotoById(
  photoId: number,
  baseUrl = '',
): Promise<{ tagged: number; faces: number }> {
  const photo = getPhotoById(photoId);
  if (!photo) return { tagged: 0, faces: 0 };

  const allEmbeddings = getAllFaceEmbeddings();
  if (!allEmbeddings.length) return { tagged: 0, faces: 0 };

  // Resolve to an absolute URL the face service can reach
  const photoUrl = photo.url.startsWith('http') ? photo.url : `${baseUrl}${photo.url}`;

  const res = await fetch(`${FACE_SERVICE()}/embed-all/url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: photoUrl }),
  });
  if (!res.ok) throw new Error(`face-service ${res.status}`);

  const { embeddings, face_count } = (await res.json()) as {
    embeddings: number[][];
    face_count: number;
  };

  let tagged = 0;
  for (const vec of embeddings) {
    const match = bestMatch(vec, allEmbeddings);
    if (match) {
      addPhotoTag(photoId, match.employee_id, match.similarity);
      tagged++;
    }
  }

  setPhotoTagStatus(photoId, 'done');
  return { tagged, faces: face_count };
}
