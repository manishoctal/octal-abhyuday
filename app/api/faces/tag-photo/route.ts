import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getPhotoById } from '@/lib/db';
import { tagPhotoById } from '@/lib/face-tag';

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { photo_id } = await req.json().catch(() => ({}));
  if (!photo_id) return NextResponse.json({ error: 'photo_id required' }, { status: 400 });

  const photo = getPhotoById(photo_id);
  if (!photo) return NextResponse.json({ error: 'Photo not found' }, { status: 404 });

  const base = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
  try {
    const { tagged, faces } = await tagPhotoById(photo_id, base);
    if (faces === 0) return NextResponse.json({ ok: true, tagged: 0, message: 'No faces detected in photo' });
    return NextResponse.json({ ok: true, tagged, faces_detected: faces });
  } catch (e) {
    return NextResponse.json({ error: `Face service unavailable: ${e}` }, { status: 503 });
  }
}
