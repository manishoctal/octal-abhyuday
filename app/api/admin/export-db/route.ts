import { NextResponse } from 'next/server';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { db } from '@/lib/db';
import { requireAdmin, isErrorResponse } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await requireAdmin();
  if (isErrorResponse(session)) return session;

  // Write a hot backup via SQLite's built-in backup API.
  // This is safe to run while the DB is live — it acquires a shared lock per
  // page and handles WAL pages automatically, producing a consistent snapshot.
  const tmp = path.join(os.tmpdir(), `vote-export-${Date.now()}.db`);
  try {
    await (db as any).backup(tmp);

    const buf = fs.readFileSync(tmp);
    const ts  = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

    return new Response(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="vote-${ts}.db"`,
        'Content-Length': String(buf.length),
        'Cache-Control': 'no-store',
      },
    });
  } finally {
    try { fs.unlinkSync(tmp); } catch { /* ignore */ }
  }
}
