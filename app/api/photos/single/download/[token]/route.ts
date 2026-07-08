import { getPhotoById } from '@/lib/db';
import { consumeToken } from '@/lib/download-tokens';
import { isS3Configured, extractS3Key } from '@/lib/s3';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const DATA_DIR = () => process.env.DATA_DIR || path.join(process.cwd(), 'data');

const MIME: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  gif: 'image/gif', webp: 'image/webp', heic: 'image/heic',
};

async function readPhotoBuffer(url: string): Promise<Buffer | null> {
  try {
    if (url.startsWith('http')) {
      const key = extractS3Key(url);
      if (!key || !isS3Configured()) return null;
      const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3');
      const client = new S3Client({
        region: process.env.AWS_REGION ?? 'ap-south-1',
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
      });
      const res = await client.send(new GetObjectCommand({ Bucket: process.env.S3_BUCKET_NAME!, Key: key }));
      if (!res.Body) return null;
      const chunks: Buffer[] = [];
      for await (const chunk of res.Body as AsyncIterable<Buffer>) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      return Buffer.concat(chunks);
    } else if (url.startsWith('/uploads/')) {
      const filePath = path.join(DATA_DIR(), url.replace(/^\//, ''));
      if (!fs.existsSync(filePath)) return null;
      return fs.readFileSync(filePath);
    }
    return null;
  } catch {
    return null;
  }
}

export async function GET(
  _req: Request,
  { params }: { params: { token: string } },
) {
  const photoIds = consumeToken(params.token);
  if (!photoIds || photoIds.length === 0) {
    return new Response('Download link expired or invalid. Please try again.', { status: 410 });
  }

  const photo = getPhotoById(photoIds[0]);
  if (!photo) {
    return new Response('Photo not found.', { status: 404 });
  }

  const buf = await readPhotoBuffer(photo.url);
  if (!buf) {
    return new Response('Could not read photo.', { status: 502 });
  }

  const ext = photo.url.split('.').pop()?.split('?')[0]?.toLowerCase() ?? 'jpg';
  const mime = MIME[ext] ?? 'image/jpeg';
  const filename = `photo-${photo.id}.${ext}`;

  return new Response(buf as unknown as BodyInit, {
    headers: {
      'Content-Type':        mime,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length':      String(buf.length),
      'Cache-Control':       'no-store',
    },
  });
}
