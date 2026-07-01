import { getPhotoById } from '@/lib/db';

export const dynamic = 'force-dynamic';

const MAX_DIM = 1920;

/**
 * Internal endpoint used by the face service to fetch a photo resized to ≤1920px.
 * Accepts ?id=<photoId>. No auth required — only serves photos that exist in DB.
 * Reduces face-service CPU/RAM dramatically (25 MB → ~300 KB per photo).
 */
export async function GET(req: Request) {
  const id = Number(new URL(req.url).searchParams.get('id'));
  if (!id) return new Response('id required', { status: 400 });

  const photo = getPhotoById(id);
  if (!photo) return new Response('Not found', { status: 404 });

  const base = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
  const url  = photo.url.startsWith('http') ? photo.url : `${base}${photo.url}`;

  const orig = await fetch(url, { signal: AbortSignal.timeout(60_000) }).catch(() => null);
  if (!orig?.ok) return new Response('Could not fetch original', { status: 502 });

  const buf = Buffer.from(await orig.arrayBuffer());
  const origKB = Math.round(buf.length / 1024);

  try {
    const sharp = (await import('sharp')).default;
    const resized = await sharp(buf)
      .resize({ width: MAX_DIM, height: MAX_DIM, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();

    console.log(`[face-resize] photo ${id}: ${origKB} KB → ${Math.round(resized.length / 1024)} KB`);

    return new Response(resized, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch {
    // Sharp unavailable — serve original unchanged
    return new Response(buf, {
      headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=86400' },
    });
  }
}
