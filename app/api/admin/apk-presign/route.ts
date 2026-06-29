import { NextResponse } from 'next/server';
import { requireAdmin, isErrorResponse } from '@/lib/api-helpers';
import { isS3Configured, presignUpload, getPublicUrl } from '@/lib/s3';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const adminOrErr = await requireAdmin();
  if (isErrorResponse(adminOrErr)) return adminOrErr;

  if (!isS3Configured()) {
    return NextResponse.json({ error: 'S3 not configured' }, { status: 503 });
  }

  const { filename } = (await req.json()) as { filename: string };
  if (!filename?.toLowerCase().endsWith('.apk')) {
    return NextResponse.json({ error: 'Only .apk files are allowed' }, { status: 400 });
  }

  const slug = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const key  = `abhyuday-2026/releases/${slug}.apk`;

  const presignedUrl = await presignUpload(key, 'application/vnd.android.package-archive', 900);
  const publicUrl    = getPublicUrl(key);

  return NextResponse.json({ presignedUrl, publicUrl });
}
