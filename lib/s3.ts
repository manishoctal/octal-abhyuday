import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
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
