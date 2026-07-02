import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { db } from '@/lib/db';
import { requireAdmin, isErrorResponse } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await requireAdmin();
  if (isErrorResponse(session)) return session;

  // Flush WAL into the main DB file so the snapshot is complete
  db.pragma('wal_checkpoint(TRUNCATE)');

  const DB_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
  const DB_PATH = path.join(DB_DIR, 'vote.db');

  if (!fs.existsSync(DB_PATH)) {
    return NextResponse.json({ error: 'Database file not found' }, { status: 404 });
  }

  const buf = fs.readFileSync(DB_PATH);
  const ts  = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

  return new Response(buf, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="vote-${ts}.db"`,
      'Content-Length': String(buf.length),
      'Cache-Control': 'no-store',
    },
  });
}
