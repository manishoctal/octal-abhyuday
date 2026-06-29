import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getPhotoById } from '@/lib/db';
import JSZip from 'jszip';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { photoIds } = await req.json().catch(() => ({}));
  if (!Array.isArray(photoIds) || photoIds.length === 0) {
    return NextResponse.json({ error: 'photoIds array required' }, { status: 400 });
  }
  if (photoIds.length > 500) {
    return NextResponse.json({ error: 'Too many photos (max 500)' }, { status: 400 });
  }

  const zip = new JSZip();
  const folder = zip.folder('matching-photos')!;

  const results = await Promise.allSettled(
    photoIds.map(async (id: number) => {
      const photo = getPhotoById(id);
      if (!photo) return;
      const res = await fetch(photo.url, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = await res.arrayBuffer();
      const ext = photo.url.split('.').pop()?.split('?')[0]?.toLowerCase() ?? 'jpg';
      folder.file(`photo-${id}.${ext}`, buf);
    })
  );

  const failed = results.filter(r => r.status === 'rejected').length;

  const zipBuf: Buffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 3 },
  });

  return new Response(zipBuf as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="face-match-photos.zip"`,
      'X-Failed-Count': String(failed),
    },
  });
}
