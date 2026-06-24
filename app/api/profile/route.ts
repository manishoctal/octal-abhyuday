import { NextResponse } from 'next/server';
import { requireUser, isErrorResponse } from '@/lib/api-helpers';
import { getUserById, updateUserProfile } from '@/lib/db';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET() {
  const userOrErr = await requireUser();
  if (isErrorResponse(userOrErr)) return userOrErr;
  const user = getUserById(userOrErr.id);
  return NextResponse.json({
    name: user?.name ?? userOrErr.name,
    email: user?.email ?? userOrErr.email,
    department: user?.department ?? null,
    profile_photo_url: user?.profile_photo_url ?? null,
  });
}

export async function POST(req: Request) {
  const userOrErr = await requireUser();
  if (isErrorResponse(userOrErr)) return userOrErr;

  const formData = await req.formData();
  const department = (formData.get('department') as string | null)?.trim() || null;
  const file = formData.get('photo') as File | null;

  const current = getUserById(userOrErr.id);
  let photoUrl = current?.profile_photo_url ?? null;

  if (file && file.size > 0) {
    const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
    const uploadsDir = path.join(dataDir, 'uploads');
    fs.mkdirSync(uploadsDir, { recursive: true });

    // Normalize JPEG variants (.jfif, .jpe, .jif, .jfi) to .jpg so browsers serve them correctly
    const rawExt = (file.name.split('.').pop() ?? 'jpg').toLowerCase();
    const JPEG_VARIANTS = new Set(['jfif', 'jpe', 'jif', 'jfi', 'jpeg']);
    const ext = JPEG_VARIANTS.has(rawExt) ? 'jpg' : rawExt;
    const filename = `profile-${userOrErr.id}-${Date.now()}.${ext}`;
    const buf = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(path.join(uploadsDir, filename), buf);
    photoUrl = `/uploads/${filename}`;
  }

  updateUserProfile(userOrErr.id, department, photoUrl);
  return NextResponse.json({ ok: true, department, profile_photo_url: photoUrl });
}
