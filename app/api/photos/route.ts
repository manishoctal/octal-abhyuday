import { NextResponse } from 'next/server';
import { requireUser, requireAdmin, isErrorResponse } from '@/lib/api-helpers';
import { listPhotos, listUserPhotos, addPhoto, approvePhoto, rejectPhoto } from '@/lib/db';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_FILES = 10;

export async function GET(req: Request) {
  const userOrErr = await requireUser();
  if (isErrorResponse(userOrErr)) return userOrErr;
  const url = new URL(req.url);
  const all  = url.searchParams.get('all')  === '1'; // admin: all photos
  const mine = url.searchParams.get('mine') === '1'; // user: own photos (all statuses)

  let photos;
  if (all)       photos = listPhotos(false);
  else if (mine) photos = listUserPhotos(userOrErr.id);
  else           photos = listPhotos(true); // approved only
  return NextResponse.json({ photos });
}

export async function POST(req: Request) {
  const userOrErr = await requireUser();
  if (isErrorResponse(userOrErr)) return userOrErr;

  const formData = await req.formData();
  const files = formData.getAll('files') as File[];

  if (!files.length) return NextResponse.json({ error: 'No files' }, { status: 400 });
  if (files.length > MAX_FILES) return NextResponse.json({ error: `Max ${MAX_FILES} files` }, { status: 400 });

  const oversized = files.find(f => f.size > MAX_SIZE);
  if (oversized) return NextResponse.json({ error: `"${oversized.name}" exceeds 5 MB limit` }, { status: 400 });

  const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
  const uploadsDir = path.join(dataDir, 'uploads');
  fs.mkdirSync(uploadsDir, { recursive: true });

  const JPEG_VARIANTS = new Set(['jfif', 'jpe', 'jif', 'jfi', 'jpeg']);
  const results: { id: number; url: string }[] = [];

  for (const file of files) {
    const rawExt = (file.name.split('.').pop() ?? 'jpg').toLowerCase();
    const ext = JPEG_VARIANTS.has(rawExt) ? 'jpg' : rawExt;
    const filename = `${Date.now()}-${userOrErr.id}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
    const buf = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(path.join(uploadsDir, filename), buf);
    const url = `/uploads/${filename}`;
    const id = addPhoto(userOrErr.id, userOrErr.name, url, null, null);
    results.push({ id, url });
  }

  return NextResponse.json({ uploaded: results.length, results });
}

export async function PATCH(req: Request) {
  const adminOrErr = await requireAdmin();
  if (isErrorResponse(adminOrErr)) return adminOrErr;
  const { id, action } = await req.json();
  if (action === 'approve') approvePhoto(id);
  else if (action === 'reject') rejectPhoto(id);
  return NextResponse.json({ ok: true });
}
