import { NextResponse } from 'next/server';
import { requireAdmin, isErrorResponse } from '@/lib/api-helpers';
import { upsertAadharCard, deleteAadharCard, listAadharWithRoomInfo } from '@/lib/db';
import { isS3Configured, presignUpload, getPublicUrl, normalizeExt } from '@/lib/s3';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const DATA_DIR = () => process.env.DATA_DIR || path.join(process.cwd(), 'data');
const ALLOWED_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

export async function GET() {
  const a = await requireAdmin();
  if (isErrorResponse(a)) return a;
  return NextResponse.json({ cards: listAadharWithRoomInfo() });
}

export async function POST(req: Request) {
  const a = await requireAdmin();
  if (isErrorResponse(a)) return a;

  const ct = req.headers.get('content-type') ?? '';

  // JSON path: { employee_id, front_url?, back_url? } (S3 presign flow — client already uploaded)
  if (ct.includes('application/json')) {
    const { employee_id, front_url, back_url } = await req.json();
    if (!employee_id) return NextResponse.json({ error: 'employee_id required' }, { status: 400 });
    upsertAadharCard(Number(employee_id), front_url, back_url);
    return NextResponse.json({ ok: true });
  }

  // Multipart path: upload front/back directly (local disk)
  const formData = await req.formData();
  const employee_id = Number(formData.get('employee_id'));
  if (!employee_id) return NextResponse.json({ error: 'employee_id required' }, { status: 400 });

  const uploadsDir = path.join(DATA_DIR(), 'uploads');
  fs.mkdirSync(uploadsDir, { recursive: true });

  async function saveFile(field: string): Promise<string | null> {
    const file = formData.get(field) as File | null;
    if (!file) return null;
    const mime = file.type.toLowerCase();
    if (!ALLOWED_MIME.has(mime)) return null;
    const rawExt = (file.name.split('.').pop() ?? 'jpg').toLowerCase();
    const ext = rawExt === 'jpeg' ? 'jpg' : rawExt;
    const filename = `aadhar-${employee_id}-${field}-${Date.now()}.${ext}`;
    fs.writeFileSync(path.join(uploadsDir, filename), Buffer.from(await file.arrayBuffer()));
    return `/uploads/${filename}`;
  }

  const front_url = await saveFile('front');
  const back_url  = await saveFile('back');
  upsertAadharCard(employee_id, front_url, back_url);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const a = await requireAdmin();
  if (isErrorResponse(a)) return a;
  const { employee_id } = await req.json().catch(() => ({}));
  if (!employee_id) return NextResponse.json({ error: 'employee_id required' }, { status: 400 });
  deleteAadharCard(Number(employee_id));
  return NextResponse.json({ ok: true });
}

// Presign endpoint for S3 uploads
export async function PUT(req: Request) {
  const a = await requireAdmin();
  if (isErrorResponse(a)) return a;
  if (!isS3Configured()) return NextResponse.json({ error: 'S3 not configured' }, { status: 503 });

  const { filename, contentType, employee_id, side } = await req.json();
  if (!filename || !contentType || !employee_id || !['front', 'back'].includes(side)) {
    return NextResponse.json({ error: 'Invalid params' }, { status: 400 });
  }

  const ext = normalizeExt(filename);
  const key = `abhyuday-2026/aadhar/${employee_id}-${side}-${Date.now()}.${ext}`;
  const presignedUrl = await presignUpload(key, contentType);
  const publicUrl    = getPublicUrl(key);
  return NextResponse.json({ presignedUrl, publicUrl });
}
