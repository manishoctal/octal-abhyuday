import { NextResponse } from 'next/server';
import { requireAdmin, isErrorResponse } from '@/lib/api-helpers';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
  const adminOrErr = await requireAdmin();
  if (isErrorResponse(adminOrErr)) return adminOrErr;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Failed to parse upload — check nginx client_max_body_size' }, { status: 400 });
  }

  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  if (!file.name.toLowerCase().endsWith('.apk')) {
    return NextResponse.json({ error: 'Only .apk files are allowed' }, { status: 400 });
  }

  const dir = path.join(process.cwd(), 'public', 'releases');
  fs.mkdirSync(dir, { recursive: true });

  // Delete old APK files to free disk space
  try {
    for (const f of fs.readdirSync(dir)) {
      if (f.endsWith('.apk')) fs.unlinkSync(path.join(dir, f));
    }
  } catch { /* ignore cleanup errors */ }

  const slug = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const filename = `abhyuday-${slug}.apk`;
  const buffer = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(path.join(dir, filename), buffer);

  return NextResponse.json({ publicUrl: `/releases/${filename}` });
  } catch (e) {
    console.error('[apk-upload]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
