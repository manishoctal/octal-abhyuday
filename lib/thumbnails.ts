import path from 'path';
import fs from 'fs';
import type { Photo } from './db';

const THUMB_WIDTH  = 600;
const THUMB_QUALITY = 80;

/** Resize an image buffer to a 600px-wide WebP. Returns null on failure. */
export async function resizeToThumbnail(inputBuffer: Buffer): Promise<Buffer | null> {
  try {
    const sharp = (await import('sharp')).default;
    return await sharp(inputBuffer)
      .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
      .webp({ quality: THUMB_QUALITY })
      .toBuffer();
  } catch {
    return null;
  }
}

/** Generate thumbnail for a local-disk photo. Returns thumbnail URL or null. */
export async function thumbnailForLocal(originalPath: string, dataDir: string): Promise<string | null> {
  try {
    const absPath = path.join(dataDir, originalPath);
    const buf = fs.readFileSync(absPath);
    const thumb = await resizeToThumbnail(buf);
    if (!thumb) return null;

    const uploadsDir = path.join(dataDir, 'uploads');
    const basename = path.basename(originalPath, path.extname(originalPath));
    const thumbName = `thumb-${basename}.webp`;
    fs.writeFileSync(path.join(uploadsDir, thumbName), thumb);
    return `/uploads/${thumbName}`;
  } catch {
    return null;
  }
}

/** Download from S3/CloudFront, resize, re-upload thumbnail. Returns thumbnail URL or null. */
export async function thumbnailForS3(
  originalUrl: string,
  photoId: number,
): Promise<string | null> {
  try {
    const { isS3Configured, presignUpload, getPublicUrl, extractS3Key } = await import('./s3');
    if (!isS3Configured()) return null;

    // Download original
    const res = await fetch(originalUrl, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());

    const thumb = await resizeToThumbnail(buf);
    if (!thumb) return null;

    // Derive a thumbnail key from the original
    const origKey = extractS3Key(originalUrl);
    const baseKey = origKey
      ? origKey.replace(/\.[^.]+$/, '') // strip extension
      : `abhyuday-2026/gallery/thumb-${photoId}`;
    const thumbKey = `${baseKey}-thumb.webp`;

    // Upload thumbnail
    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
    const client = new S3Client({
      region: process.env.AWS_REGION ?? 'ap-south-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
    await client.send(new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME!,
      Key: thumbKey,
      Body: thumb,
      ContentType: 'image/webp',
    }));

    return getPublicUrl(thumbKey);
  } catch {
    return null;
  }
}

/** Fire-and-forget: generate thumbnail for one photo and persist it to DB. */
export async function generateThumbnailAsync(photo: Photo, dataDir: string): Promise<void> {
  try {
    const { setPhotoThumbnail } = await import('./db');
    const { isS3Configured } = await import('./s3');

    let thumbUrl: string | null = null;
    if (photo.url.startsWith('http')) {
      if (isS3Configured()) thumbUrl = await thumbnailForS3(photo.url, photo.id);
    } else if (photo.url.startsWith('/uploads/')) {
      thumbUrl = await thumbnailForLocal(photo.url, dataDir);
    }

    if (thumbUrl) setPhotoThumbnail(photo.id, thumbUrl);
  } catch { /* best-effort */ }
}
