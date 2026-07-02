import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: { filename: string } }
) {
  // Block unauthenticated access to all uploaded files
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Aadhar cards are admin-only — they contain sensitive personal identity documents
  const filename = params.filename;
  if (filename.startsWith('aadhar-') && !session.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Guard against path traversal (e.g. ../../etc/passwd)
  const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
  const uploadsDir = path.join(dataDir, 'uploads');
  const filePath = path.resolve(uploadsDir, filename);
  if (!filePath.startsWith(uploadsDir + path.sep) && filePath !== uploadsDir) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const buf = fs.readFileSync(filePath);
  const ext = filename.split('.').pop()?.toLowerCase() ?? 'jpg';
  const ct = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : ext === 'gif' ? 'image/gif' : 'image/jpeg';

  return new Response(buf, {
    headers: {
      'Content-Type': ct,
      // Authenticated — safe to cache privately; immutable since filenames include timestamps
      'Cache-Control': 'private, max-age=31536000, immutable',
    },
  });
}
