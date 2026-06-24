import { NextResponse } from 'next/server';
import { requireUser, isErrorResponse } from '@/lib/api-helpers';
import { isS3Configured, presignUpload, getPublicUrl, normalizeExt } from '@/lib/s3';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const userOrErr = await requireUser();
  if (isErrorResponse(userOrErr)) return userOrErr;

  if (!isS3Configured()) {
    return NextResponse.json({ error: 'S3 not configured' }, { status: 503 });
  }

  const { filename, contentType, context } = await req.json() as {
    filename: string;
    contentType: string;
    context: 'gallery' | 'profile';
  };

  const ext = normalizeExt(filename);
  const slug = `${Date.now()}-${userOrErr.id}-${Math.random().toString(36).slice(2, 7)}`;
  const key = `abhyuday-2026/${context}/${slug}.${ext}`;

  const presignedUrl = await presignUpload(key, contentType || 'image/jpeg');
  const publicUrl    = getPublicUrl(key);

  return NextResponse.json({ presignedUrl, publicUrl });
}
