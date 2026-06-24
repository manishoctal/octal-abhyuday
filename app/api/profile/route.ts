import { NextResponse } from 'next/server';
import { requireUser, isErrorResponse } from '@/lib/api-helpers';
import { getUserById, updateUserProfile } from '@/lib/db';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const JPEG_VARIANTS = new Set(['jfif', 'jpe', 'jif', 'jfi', 'jpeg']);

export async function GET() {
  const userOrErr = await requireUser();
  if (isErrorResponse(userOrErr)) return userOrErr;
  const user = getUserById(userOrErr.id);
  return NextResponse.json({
    name:              user?.name             ?? userOrErr.name,
    email:             user?.email            ?? userOrErr.email,
    department:        user?.department       ?? null,
    profile_photo_url: user?.profile_photo_url ?? null,
  });
}

export async function POST(req: Request) {
  const userOrErr = await requireUser();
  if (isErrorResponse(userOrErr)) return userOrErr;

  const ct      = req.headers.get('content-type') ?? '';
  const current = getUserById(userOrErr.id);
  let photoUrl  = current?.profile_photo_url ?? null;

  /* ── S3 path: photo already on CloudFront, receive URL + department as JSON ── */
  if (ct.includes('application/json')) {
    const body = await req.json() as { department?: string; photoUrl?: string };
    const department = body.department?.trim() || null;
    if (body.photoUrl) photoUrl = body.photoUrl;
    updateUserProfile(userOrErr.id, department, photoUrl);
    return NextResponse.json({ ok: true, department, profile_photo_url: photoUrl });
  }

  /* ── Local disk path: file in FormData ── */
  const formData   = await req.formData();
  const department = (formData.get('department') as string | null)?.trim() || null;
  const file       = formData.get('photo') as File | null;

  if (file && file.size > 0) {
    const dataDir    = process.env.DATA_DIR || path.join(process.cwd(), 'data');
    const uploadsDir = path.join(dataDir, 'uploads');
    fs.mkdirSync(uploadsDir, { recursive: true });

    const rawExt = (file.name.split('.').pop() ?? 'jpg').toLowerCase();
    const ext    = JPEG_VARIANTS.has(rawExt) ? 'jpg' : rawExt;
    const filename = `profile-${userOrErr.id}-${Date.now()}.${ext}`;
    fs.writeFileSync(path.join(uploadsDir, filename), Buffer.from(await file.arrayBuffer()));
    photoUrl = `/uploads/${filename}`;
  }

  updateUserProfile(userOrErr.id, department, photoUrl);
  return NextResponse.json({ ok: true, department, profile_photo_url: photoUrl });
}
