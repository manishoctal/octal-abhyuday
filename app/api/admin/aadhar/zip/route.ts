import { NextResponse } from 'next/server';
import { requireAdmin, isErrorResponse } from '@/lib/api-helpers';
import { listAadharWithRoomInfo } from '@/lib/db';
import JSZip from 'jszip';

export const dynamic = 'force-dynamic';

export async function POST() {
  const a = await requireAdmin();
  if (isErrorResponse(a)) return a;

  const cards = listAadharWithRoomInfo().filter(c => c.front_url || c.back_url);
  if (cards.length === 0) return NextResponse.json({ error: 'No Aadhar cards uploaded yet' }, { status: 404 });

  const zip = new JSZip();

  const results = await Promise.allSettled(
    cards.flatMap(card => {
      const folder = card.room_number ? `Room ${card.room_number}` : 'Unassigned';
      const safeName = card.name.replace(/[^a-zA-Z0-9_\- ]/g, '_');
      const tasks: Promise<void>[] = [];

      async function fetchAndAdd(url: string, label: string) {
        const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const ext = url.split('.').pop()?.split('?')[0]?.toLowerCase() ?? 'jpg';
        const buf = await res.arrayBuffer();
        zip.folder(folder)!.file(`${safeName}_${label}.${ext}`, buf);
      }

      if (card.front_url) tasks.push(fetchAndAdd(card.front_url, 'Front'));
      if (card.back_url)  tasks.push(fetchAndAdd(card.back_url,  'Back'));
      return tasks;
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
      'Content-Disposition': 'attachment; filename="aadhar-cards.zip"',
      'X-Failed-Count': String(failed),
    },
  });
}
