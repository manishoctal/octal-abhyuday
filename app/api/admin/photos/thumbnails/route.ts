import { NextResponse } from 'next/server';
import { requireAdmin, isErrorResponse } from '@/lib/api-helpers';
import { listPhotosWithoutThumbnail } from '@/lib/db';
import { generateThumbnailAsync } from '@/lib/thumbnails';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const adminOrErr = await requireAdmin();
  if (isErrorResponse(adminOrErr)) return adminOrErr;

  const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
  const photos  = listPhotosWithoutThumbnail();

  if (photos.length === 0) return NextResponse.json({ ok: true, processed: 0 });

  // Run in background — respond immediately so the browser doesn't time out
  (async () => {
    // Process 4 at a time to avoid overwhelming S3/disk
    for (let i = 0; i < photos.length; i += 4) {
      await Promise.allSettled(
        photos.slice(i, i + 4).map(p => generateThumbnailAsync(p, dataDir))
      );
    }
  })();

  return NextResponse.json({ ok: true, queued: photos.length });
}

export async function GET(req: Request) {
  const adminOrErr = await requireAdmin();
  if (isErrorResponse(adminOrErr)) return adminOrErr;
  const photos = listPhotosWithoutThumbnail();
  return NextResponse.json({ missing: photos.length });
}
