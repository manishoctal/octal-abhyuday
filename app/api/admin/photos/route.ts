import { NextResponse } from 'next/server';
import { requireAdmin, isErrorResponse } from '@/lib/api-helpers';
import { addPhotoPreApproved, getPhotoById, setPhotoTagStatus } from '@/lib/db';
import { generateThumbnailAsync } from '@/lib/thumbnails';
import { tagPhotoById } from '@/lib/face-tag';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const MAX_SIZE  = 200 * 1024 * 1024; // local disk only — S3 has no server-side limit
const MAX_FILES = 1000;

// ── Concurrency-limited face-tagging queue ──────────────────────────────────
// All uploaded photos share this queue so the face service is never hit with
// more than TAG_CONCURRENCY simultaneous requests (avoids localhost:3000 read
// timeouts when uploading hundreds of photos at once).
const TAG_CONCURRENCY = parseInt(process.env.FACE_TAG_CONCURRENCY ?? '3', 10);
let _activeTagJobs = 0;
const _tagQueue: Array<() => Promise<void>> = [];

function drainTagQueue() {
  while (_activeTagJobs < TAG_CONCURRENCY && _tagQueue.length > 0) {
    const job = _tagQueue.shift()!;
    _activeTagJobs++;
    job().finally(() => { _activeTagJobs--; drainTagQueue(); });
  }
}

function enqueueTag(id: number, base: string) {
  _tagQueue.push(() =>
    tagPhotoById(id, base)
      .then(r => console.log(`[admin/photos/tag] photo ${id}: ${r.tagged} matched, ${r.faces} faces`))
      .catch(err => {
        console.error(`[admin/photos/tag] photo ${id} failed:`, err?.message ?? err);
        setPhotoTagStatus(id, 'failed');
      })
  );
  drainTagQueue();
}
const JPEG_VARIANTS = new Set(['jfif', 'jpe', 'jif', 'jfi', 'jpeg']);
const DATA_DIR = () => process.env.DATA_DIR || path.join(process.cwd(), 'data');

export async function POST(req: Request) {
  const adminOrErr = await requireAdmin();
  if (isErrorResponse(adminOrErr)) return adminOrErr;

  const ct = req.headers.get('content-type') ?? '';

  /* ── S3 path: client uploaded directly, register CloudFront URLs ── */
  if (ct.includes('application/json')) {
    const { urls, caption } = await req.json() as { urls: string[]; caption?: string };
    if (!urls?.length) return NextResponse.json({ error: 'No URLs provided' }, { status: 400 });
    if (urls.length > MAX_FILES) return NextResponse.json({ error: `Max ${MAX_FILES} files` }, { status: 400 });

    const s3Base = (process.env.S3_PUBLIC_URL ?? '').replace(/\/$/, '');
    if (s3Base) {
      const bad = urls.find(u => !u.startsWith(s3Base));
      if (bad) return NextResponse.json({ error: 'Invalid photo URL' }, { status: 400 });
    }

    const base = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
    const ids = urls.map(url =>
      addPhotoPreApproved(adminOrErr.id, adminOrErr.name, url, caption ?? null, null)
    );

    for (const id of ids) {
      const photo = getPhotoById(id);
      if (photo) generateThumbnailAsync(photo, DATA_DIR()).catch(() => {});
      enqueueTag(id, base);
    }

    return NextResponse.json({ uploaded: ids.length });
  }

  /* ── Local disk path ── */
  const formData = await req.formData();
  const files    = formData.getAll('files') as File[];
  const caption  = (formData.get('caption') as string | null) ?? null;

  if (!files.length) return NextResponse.json({ error: 'No files' }, { status: 400 });
  if (files.length > MAX_FILES) return NextResponse.json({ error: `Max ${MAX_FILES} files` }, { status: 400 });

  const oversized = files.find(f => f.size > MAX_SIZE);
  if (oversized) return NextResponse.json({ error: `"${oversized.name}" exceeds 200 MB limit` }, { status: 400 });

  const uploadsDir = path.join(DATA_DIR(), 'uploads');
  fs.mkdirSync(uploadsDir, { recursive: true });

  const base = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';

  for (const file of files) {
    const rawExt  = (file.name.split('.').pop() ?? 'jpg').toLowerCase();
    const ext     = JPEG_VARIANTS.has(rawExt) ? 'jpg' : rawExt;
    const filename = `${Date.now()}-admin-${Math.random().toString(36).slice(2, 7)}.${ext}`;
    fs.writeFileSync(path.join(uploadsDir, filename), Buffer.from(await file.arrayBuffer()));
    const url = `/uploads/${filename}`;
    const id  = addPhotoPreApproved(adminOrErr.id, adminOrErr.name, url, caption, null);
    const photo = getPhotoById(id);
    if (photo) generateThumbnailAsync(photo, DATA_DIR()).catch(() => {});
    enqueueTag(id, base);
  }

  return NextResponse.json({ uploaded: files.length });
}
