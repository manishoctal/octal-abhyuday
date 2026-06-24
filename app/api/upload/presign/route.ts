import { NextResponse } from 'next/server';
import { requireUser, isErrorResponse } from '@/lib/api-helpers';
import { isS3Configured, presignUpload, getPublicUrl, normalizeExt } from '@/lib/s3';

export const dynamic = 'force-dynamic';

const ALLOWED_CONTEXTS = new Set<string>(['gallery', 'profile']);
const ALLOWED_MIME = new Set<string>([
  'image/jpeg', 'image/jpg', 'image/png', 'image/gif',
  'image/webp', 'image/heic', 'image/heif',
]);

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

  if (!context || !ALLOWED_CONTEXTS.has(context)) {
    return NextResponse.json({ error: 'Invalid upload context' }, { status: 400 });
  }
  if (!contentType || !ALLOWED_MIME.has(contentType.toLowerCase())) {
    return NextResponse.json({ error: 'Only image files are allowed' }, { status: 400 });
  }

  const ext = normalizeExt(filename);
  const slug = `${Date.now()}-${userOrErr.id}-${Math.random().toString(36).slice(2, 7)}`;
  const key = `abhyuday-2026/${context}/${slug}.${ext}`;

  const presignedUrl = await presignUpload(key, contentType || 'image/jpeg');
  const publicUrl    = getPublicUrl(key);

  return NextResponse.json({ presignedUrl, publicUrl });
}
