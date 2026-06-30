import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { listPhotosNeedingTag, countPhotosNeedingTag } from '@/lib/db';
import { tagPhotoById } from '@/lib/face-tag';
import { setPhotoTagStatus } from '@/lib/db';

export async function GET() {
  const session = await getSession();
  if (!session?.isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json(countPhotosNeedingTag());
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const photoId: number | undefined = body.photo_id;

  const base = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';

  // Single photo re-tag
  if (photoId) {
    try {
      const { tagged, faces } = await tagPhotoById(photoId, base);
      return NextResponse.json({ ok: true, tagged, faces });
    } catch {
      setPhotoTagStatus(photoId, 'failed');
      return NextResponse.json({ error: 'Face service unavailable' }, { status: 503 });
    }
  }

  // Bulk: re-tag all untagged + failed
  const photos = listPhotosNeedingTag();
  if (!photos.length) return NextResponse.json({ ok: true, processed: 0, tagged: 0, failed: 0 });

  let tagged = 0, failed = 0;
  for (const photo of photos) {
    try {
      const result = await tagPhotoById(photo.id, base);
      tagged += result.tagged;
    } catch {
      setPhotoTagStatus(photo.id, 'failed');
      failed++;
    }
  }

  return NextResponse.json({ ok: true, processed: photos.length, tagged, failed });
}
