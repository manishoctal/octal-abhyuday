import { S3Client, PutObjectCommand, DeleteObjectCommand, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export function isS3Configured(): boolean {
  return !!(
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY &&
    process.env.S3_BUCKET_NAME
  );
}

function buildClient() {
  return new S3Client({
    region: process.env.AWS_REGION ?? 'ap-south-1',
    credentials: {
      accessKeyId:     process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
}

export function getPublicUrl(key: string): string {
  const base = (process.env.S3_PUBLIC_URL ?? '').replace(/\/$/, '') ||
    `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION ?? 'ap-south-1'}.amazonaws.com`;
  return `${base}/${key}`;
}

const JPEG_VARIANTS = new Set(['jfif', 'jpe', 'jif', 'jfi', 'jpeg']);

export function normalizeExt(filename: string): string {
  const raw = (filename.split('.').pop() ?? 'jpg').toLowerCase();
  return JPEG_VARIANTS.has(raw) ? 'jpg' : raw;
}

/** Extract the S3 key from a CloudFront or S3 public URL. Returns null if not an S3 URL. */
export function extractS3Key(url: string): string | null {
  if (!url) return null;
  const base = (process.env.S3_PUBLIC_URL ?? '').replace(/\/$/, '');
  if (base && url.startsWith(base + '/')) return url.slice(base.length + 1);
  // fallback: s3.amazonaws.com/bucket/key or bucket.s3.region.amazonaws.com/key
  const m = url.match(/amazonaws\.com\/(?:[^/]+\/)?(.+)$/);
  return m ? m[1] : null;
}

export async function deleteS3Object(url: string): Promise<void> {
  const key = extractS3Key(url);
  if (!key || !isS3Configured()) return;
  await buildClient().send(new DeleteObjectCommand({
    Bucket: process.env.S3_BUCKET_NAME!,
    Key: key,
  }));
}

/** Bulk-delete up to 1000 S3 keys per request. Ignores non-S3 URLs silently. */
export async function deleteS3Objects(urls: string[]): Promise<void> {
  if (!isS3Configured()) return;
  const keys = urls.map(u => extractS3Key(u)).filter(Boolean) as string[];
  if (!keys.length) return;
  const client = buildClient();
  // DeleteObjectsCommand accepts max 1000 per call
  for (let i = 0; i < keys.length; i += 1000) {
    await client.send(new DeleteObjectsCommand({
      Bucket: process.env.S3_BUCKET_NAME!,
      Delete: { Objects: keys.slice(i, i + 1000).map(Key => ({ Key })), Quiet: true },
    }));
  }
}

export async function presignUpload(
  key: string,
  contentType: string,
  expiresIn = 300,
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: process.env.S3_BUCKET_NAME!,
    Key:    key,
    ContentType: contentType,
  });
  return getSignedUrl(buildClient(), command, { expiresIn });
}
