import { requireUser, isErrorResponse } from '@/lib/api-helpers';
import { getPhotoById } from '@/lib/db';
import { isS3Configured, extractS3Key } from '@/lib/s3';
import JSZip from 'jszip';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const DATA_DIR = () => process.env.DATA_DIR || path.join(process.cwd(), 'data');

// ── Per-user zip download rate limiter ────────────────────────────────────────
// Configurable via env vars; defaults: 5 downloads per 10-minute window.
const RATE_LIMIT  = parseInt(process.env.ZIP_RATE_LIMIT  ?? '5',   10);  // max downloads
const RATE_WINDOW = parseInt(process.env.ZIP_RATE_WINDOW ?? '600', 10);  // seconds

interface RateEntry { count: number; windowStart: number }
const rateLimiter = new Map<number, RateEntry>();

function checkRateLimit(userId: number): { allowed: boolean; remaining: number; resetInSec: number } {
  const now        = Date.now();
  const windowMs   = RATE_WINDOW * 1000;
  const entry      = rateLimiter.get(userId);

  if (!entry || now - entry.windowStart >= windowMs) {
    // New or expired window — reset
    rateLimiter.set(userId, { count: 1, windowStart: now });
    return { allowed: true, remaining: RATE_LIMIT - 1, resetInSec: RATE_WINDOW };
  }

  if (entry.count >= RATE_LIMIT) {
    const resetInSec = Math.ceil((entry.windowStart + windowMs - now) / 1000);
    return { allowed: false, remaining: 0, resetInSec };
  }

  entry.count++;
  return { allowed: true, remaining: RATE_LIMIT - entry.count, resetInSec: Math.ceil((entry.windowStart + windowMs - now) / 1000) };
}

async function readPhotoBuffer(url: string): Promise<Buffer | null> {
  try {
    if (url.startsWith('http')) {
      // S3 / CloudFront — download directly via SDK, no HTTP roundtrip
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
      const res = await client.send(new GetObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME!,
        Key: key,
      }));
      if (!res.Body) return null;
      const chunks: Buffer[] = [];
      for await (const chunk of res.Body as AsyncIterable<Buffer>) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      return Buffer.concat(chunks);
    } else if (url.startsWith('/uploads/')) {
      // Local disk — read directly, no HTTP roundtrip
      const filePath = path.join(DATA_DIR(), url.replace(/^\//, ''));
      if (!fs.existsSync(filePath)) return null;
      return fs.readFileSync(filePath);
    }
    return null;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const userOrErr = await requireUser();
  if (isErrorResponse(userOrErr)) return userOrErr;

  const { allowed, remaining, resetInSec } = checkRateLimit(userOrErr.id);
  if (!allowed) {
    return Response.json(
      { error: `Download limit reached. You can download up to ${RATE_LIMIT} zips every ${Math.round(RATE_WINDOW / 60)} minutes. Try again in ${resetInSec}s.` },
      {
        status: 429,
        headers: {
          'Retry-After':               String(resetInSec),
          'X-RateLimit-Limit':         String(RATE_LIMIT),
          'X-RateLimit-Remaining':     '0',
          'X-RateLimit-Reset':         String(Math.ceil(Date.now() / 1000) + resetInSec),
        },
      },
    );
  }

  const { photoIds } = await req.json().catch(() => ({}));
  if (!Array.isArray(photoIds) || photoIds.length === 0) {
    return Response.json({ error: 'photoIds array required' }, { status: 400 });
  }
  if (photoIds.length > 500) {
    return Response.json({ error: 'Too many photos (max 500)' }, { status: 400 });
  }

  const zip = new JSZip();
  const folder = zip.folder('matching-photos')!;

  // Process in batches of 6 to cap memory usage
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
      'Content-Disposition': 'attachment; filename="my-event-photos.zip"',
      'Content-Length':      String(zipBuf.length), // lets client show real download %
    },
  });
}
