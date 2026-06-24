import { NextResponse } from 'next/server';
import { requireAdmin, isErrorResponse } from '@/lib/api-helpers';
import {
  listAwardCategories,
  createAwardCategory, updateAwardCategory, deleteAwardCategory,
  createAwardNominee, deleteAwardNominee,
  announceWinner, clearWinner,
} from '@/lib/db';
import { broadcast } from '@/lib/events';

export const dynamic = 'force-dynamic';

export async function GET() {
  const cats = listAwardCategories();
  return NextResponse.json({ categories: cats });
}

export async function POST(req: Request) {
  const adminOrErr = await requireAdmin();
  if (isErrorResponse(adminOrErr)) return adminOrErr;

  const body = await req.json();
  const { action } = body;

  if (action === 'create_category') {
    const id = createAwardCategory(body.name, body.description ?? null, body.sort_order ?? 0);
    return NextResponse.json({ id });
  }
  if (action === 'update_category') {
    updateAwardCategory(body.id, body.name, body.description ?? null);
    return NextResponse.json({ ok: true });
  }
  if (action === 'delete_category') {
    deleteAwardCategory(body.id);
    return NextResponse.json({ ok: true });
  }
  if (action === 'add_nominee') {
    createAwardNominee(body.category_id, body.name, body.department ?? null, body.image_url ?? null);
    return NextResponse.json({ ok: true });
  }
  if (action === 'delete_nominee') {
    deleteAwardNominee(body.id);
    return NextResponse.json({ ok: true });
  }
  if (action === 'announce_winner') {
    announceWinner(body.category_id, body.nominee_id);
    broadcast('state');
    return NextResponse.json({ ok: true });
  }
  if (action === 'clear_winner') {
    clearWinner(body.category_id);
    broadcast('state');
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
