import { NextResponse } from 'next/server';
import { requireAdmin, isErrorResponse } from '@/lib/api-helpers';
import { deleteAllPhotos } from '@/lib/db';
import { deleteS3Objects, isS3Configured } from '@/lib/s3';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function DELETE(req: Request) {
  const adminOrErr = await requireAdmin();
  if (isErrorResponse(adminOrErr)) return adminOrErr;

  // Collect all URLs before wiping DB
  const rows = deleteAllPhotos();
  const count = rows.length;

  const allUrls = rows.flatMap(r => [r.url, r.thumbnail_url].filter(Boolean) as string[]);

  // Delete from S3 in bulk
  if (isS3Configured()) {
    const s3Urls = allUrls.filter(u => u.startsWith('http'));
    deleteS3Objects(s3Urls).catch(() => {}); // fire-and-forget
  }

  // Delete local disk files
  const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
  for (const url of allUrls.filter(u => u.startsWith('/uploads/'))) {
    try { fs.unlinkSync(path.join(dataDir, url)); } catch { /* already gone */ }
  }

  return NextResponse.json({ ok: true, deleted: count });
}
