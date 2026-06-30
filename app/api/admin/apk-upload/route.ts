import { NextResponse } from 'next/server';
import { requireAdmin, isErrorResponse } from '@/lib/api-helpers';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

export const dynamic = 'force-dynamic';

const s3 = new S3Client({ region: process.env.AWS_REGION ?? 'ap-south-1' });
const BUCKET   = process.env.S3_BUCKET_NAME  ?? '';
const CF_BASE  = (process.env.S3_PUBLIC_URL  ?? '').replace(/\/$/, '');
// Upload under a dedicated prefix so it's easy to find in the S3 console
const S3_PREFIX = 'abhyuday-releases';

export async function POST(req: Request) {
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
  if (!BUCKET) return NextResponse.json({ error: 'S3_BUCKET_NAME not configured' }, { status: 500 });
  if (!CF_BASE) return NextResponse.json({ error: 'S3_PUBLIC_URL not configured' }, { status: 500 });

  // Unique key every upload — CloudFront has never seen this path, so no stale cache
  const slug = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const key  = `${S3_PREFIX}/abhyuday-${slug}.apk`;
  const buffer = Buffer.from(await file.arrayBuffer());

  await s3.send(new PutObjectCommand({
    Bucket:      BUCKET,
    Key:         key,
    Body:        buffer,
    ContentType: 'application/vnd.android.package-archive',
    ContentDisposition: 'attachment; filename="abhyuday.apk"',
  }));

  // CloudFront URL is absolute — works directly in QR codes and download links
  const publicUrl = `${CF_BASE}/${key}`;
  return NextResponse.json({ publicUrl });
}
