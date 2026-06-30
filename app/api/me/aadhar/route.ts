import { NextResponse } from 'next/server';
import { requireUser, isErrorResponse } from '@/lib/api-helpers';
import { getEmployeeByEmail, getAadharByEmployee, upsertAadharCard } from '@/lib/db';
import { isS3Configured, presignUpload, getPublicUrl, normalizeExt } from '@/lib/s3';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const DATA_DIR = () => process.env.DATA_DIR || path.join(process.cwd(), 'data');
const ALLOWED_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

async function getEmployeeId(userEmail: string): Promise<number | null> {
  const emp = getEmployeeByEmail(userEmail);
  return emp?.id ?? null;
}

export async function GET() {
  const userOrErr = await requireUser();
  if (isErrorResponse(userOrErr)) return userOrErr;
  const empId = await getEmployeeId(userOrErr.email);
  if (!empId) return NextResponse.json({ card: null });
  return NextResponse.json({ card: getAadharByEmployee(empId) });
}

export async function POST(req: Request) {
  const userOrErr = await requireUser();
  if (isErrorResponse(userOrErr)) return userOrErr;
  const empId = await getEmployeeId(userOrErr.email);
  if (!empId) return NextResponse.json({ error: 'Employee record not found' }, { status: 404 });

  const ct = req.headers.get('content-type') ?? '';

  // JSON path: { front_url?, back_url? } — client already uploaded to S3
  if (ct.includes('application/json')) {
    const { front_url, back_url } = await req.json();
    upsertAadharCard(empId, front_url, back_url);
    return NextResponse.json({ ok: true });
  }

  // Multipart path: direct file upload (local disk)
  const formData = await req.formData();
  const uploadsDir = path.join(DATA_DIR(), 'uploads');
  fs.mkdirSync(uploadsDir, { recursive: true });

  async function saveFile(field: string): Promise<string | null> {
    const file = formData.get(field) as File | null;
    if (!file) return null;
    const mime = file.type.toLowerCase();
    if (!ALLOWED_MIME.has(mime)) return null;
    const rawExt = (file.name.split('.').pop() ?? 'jpg').toLowerCase();
    const ext = rawExt === 'jpeg' ? 'jpg' : rawExt;
    const filename = `aadhar-${empId}-${field}-${Date.now()}.${ext}`;
    fs.writeFileSync(path.join(uploadsDir, filename), Buffer.from(await file.arrayBuffer()));
    return `/uploads/${filename}`;
  }

  const front_url = await saveFile('front');
  const back_url  = await saveFile('back');
  upsertAadharCard(empId, front_url, back_url);
  return NextResponse.json({ ok: true });
}

// S3 presign
export async function PUT(req: Request) {
  const userOrErr = await requireUser();
  if (isErrorResponse(userOrErr)) return userOrErr;
  if (!isS3Configured()) return NextResponse.json({ error: 'S3 not configured' }, { status: 503 });

  const empId = await getEmployeeId(userOrErr.email);
  if (!empId) return NextResponse.json({ error: 'Employee record not found' }, { status: 404 });

  const { filename, contentType: rawCt, side } = await req.json();
  if (!filename || !['front', 'back'].includes(side)) {
    return NextResponse.json({ error: 'Invalid params' }, { status: 400 });
  }
  // Normalise content type — mobile browsers sometimes send empty string
  const contentType = rawCt || 'image/jpeg';

  const ext = normalizeExt(filename);
  const key = `abhyuday-2026/aadhar/${empId}-${side}-${Date.now()}.${ext}`;
  const presignedUrl = await presignUpload(key, contentType);
  const publicUrl    = getPublicUrl(key);
  return NextResponse.json({ presignedUrl, publicUrl });
}
