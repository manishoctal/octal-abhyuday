import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const DATA_DIR = () => process.env.DATA_DIR || path.join(process.cwd(), 'data');

export async function GET(
  _req: Request,
  { params }: { params: { filename: string } },
) {
  const { filename } = params;

  // Sanitize — only allow safe filenames, no path traversal
  if (!/^[a-zA-Z0-9_\-\.]+\.apk$/i.test(filename)) {
    return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
  }

  const filePath = path.join(DATA_DIR(), 'releases', filename);

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: 'APK not found' }, { status: 404 });
  }

  const buffer = fs.readFileSync(filePath);

  return new Response(buffer as unknown as BodyInit, {
    headers: {
      'Content-Type':        'application/vnd.android.package-archive',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length':      String(buffer.length),
      'Cache-Control':       'no-store',
    },
  });
}
