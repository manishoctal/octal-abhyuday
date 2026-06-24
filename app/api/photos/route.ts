import { NextResponse } from 'next/server';
import { requireUser, requireAdmin, isErrorResponse } from '@/lib/api-helpers';
import { listPhotos, listUserPhotos, addPhoto, approvePhoto, rejectPhoto } from '@/lib/db';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const MAX_SIZE  = 5 * 1024 * 1024;
const MAX_FILES = 10;
const JPEG_VARIANTS = new Set(['jfif', 'jpe', 'jif', 'jfi', 'jpeg']);

export async function GET(req: Request) {
  const url  = new URL(req.url);
  const all  = url.searchParams.get('all')  === '1';
  const mine = url.searchParams.get('mine') === '1';

  if (all) {
    const adminOrErr = await requireAdmin();
    if (isErrorResponse(adminOrErr)) return adminOrErr;
    return NextResponse.json({ photos: listPhotos(false) });
  }

  const userOrErr = await requireUser();
  if (isErrorResponse(userOrErr)) return userOrErr;

  const photos = mine ? listUserPhotos(userOrErr.id) : listPhotos(true);
  return NextResponse.json({ photos });
}

export async function POST(req: Request) {
  const userOrErr = await requireUser();
  if (isErrorResponse(userOrErr)) return userOrErr;

  const ct = req.headers.get('content-type') ?? '';

  /* ── S3 path: client already uploaded, just register the CloudFront URLs ── */
  if (ct.includes('application/json')) {
    const { urls } = await req.json() as { urls: string[] };
    if (!urls?.length) return NextResponse.json({ error: 'No URLs provided' }, { status: 400 });
    if (urls.length > MAX_FILES) return NextResponse.json({ error: `Max ${MAX_FILES} files` }, { status: 400 });

    const s3Base = (process.env.S3_PUBLIC_URL ?? '').replace(/\/$/, '');
    if (s3Base) {
      const bad = urls.find(u => !u.startsWith(s3Base));
      if (bad) return NextResponse.json({ error: 'Invalid photo URL' }, { status: 400 });
    }

    const results = urls.map(url => ({
      id: addPhoto(userOrErr.id, userOrErr.name, url, null, null),
      url,
    }));
    return NextResponse.json({ uploaded: results.length, results });
  }

  /* ── Local disk path: store files on server ── */
  const formData = await req.formData();
  const files    = formData.getAll('files') as File[];

  if (!files.length) return NextResponse.json({ error: 'No files' }, { status: 400 });
  if (files.length > MAX_FILES) return NextResponse.json({ error: `Max ${MAX_FILES} files` }, { status: 400 });

  const oversized = files.find(f => f.size > MAX_SIZE);
  if (oversized) return NextResponse.json({ error: `"${oversized.name}" exceeds 5 MB limit` }, { status: 400 });

  const dataDir    = process.env.DATA_DIR || path.join(process.cwd(), 'data');
  const uploadsDir = path.join(dataDir, 'uploads');
  fs.mkdirSync(uploadsDir, { recursive: true });

  const results: { id: number; url: string }[] = [];
  for (const file of files) {
    const rawExt  = (file.name.split('.').pop() ?? 'jpg').toLowerCase();
    const ext     = JPEG_VARIANTS.has(rawExt) ? 'jpg' : rawExt;
    const filename = `${Date.now()}-${userOrErr.id}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
    fs.writeFileSync(path.join(uploadsDir, filename), Buffer.from(await file.arrayBuffer()));
    const url = `/uploads/${filename}`;
    results.push({ id: addPhoto(userOrErr.id, userOrErr.name, url, null, null), url });
  }

  return NextResponse.json({ uploaded: results.length, results });
}

export async function PATCH(req: Request) {
  const adminOrErr = await requireAdmin();
  if (isErrorResponse(adminOrErr)) return adminOrErr;
  const { id, action } = await req.json();
  if (typeof id !== 'number') return NextResponse.json({ error: 'id required' }, { status: 400 });
  if (action === 'approve') approvePhoto(id);
  else if (action === 'reject') rejectPhoto(id);
  else return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  return NextResponse.json({ ok: true });
}
