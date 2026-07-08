import { getPhotoById } from '@/lib/db';
import { consumeToken } from '@/lib/download-tokens';
import { isS3Configured, extractS3Key } from '@/lib/s3';
import JSZip from 'jszip';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const DATA_DIR = () => process.env.DATA_DIR || path.join(process.cwd(), 'data');

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
  if (!photoIds) {
    return new Response('Download link expired or invalid. Please try again.', { status: 410 });
  }

  const zip = new JSZip();
  const folder = zip.folder('event-photos')!;

  for (let i = 0; i < photoIds.length; i += 6) {
    await Promise.allSettled(
      photoIds.slice(i, i + 6).map(async (id: number) => {
        const photo = getPhotoById(id);
        if (!photo) return;
        const buf = await readPhotoBuffer(photo.url);
        if (!buf) return;
        const ext = photo.url.split('.').pop()?.split('?')[0]?.toLowerCase() ?? 'jpg';
        folder.file(`photo-${id}.${ext}`, buf);
      })
    );
  }

  const zipBuf: Buffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 3 },
  });

  return new Response(zipBuf as unknown as BodyInit, {
    headers: {
      'Content-Type':        'application/zip',
      'Content-Disposition': 'attachment; filename="event-photos.zip"',
      'Content-Length':      String(zipBuf.length),
      'Cache-Control':       'no-store',
    },
  });
}
