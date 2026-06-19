import { NextResponse } from 'next/server';
import {
  createCandidate,
  updateCandidate,
  deleteCandidate,
  getCandidate,
  getCandidateByEmail,
  listCandidates,
  getAppState,
} from '@/lib/db';
import { requireAdmin, isErrorResponse } from '@/lib/api-helpers';
import { broadcast } from '@/lib/events';
import type { Gender } from '@/lib/types';

export const dynamic = 'force-dynamic';

function validateCandidate(body: Record<string, unknown>) {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  // Gender may be unset (auto-imported employees) — those stay off ballots
  const gender: Gender | null =
    body.gender === 'male' || body.gender === 'female' ? body.gender : null;
  const imageUrl = typeof body.imageUrl === 'string' ? body.imageUrl.trim() : '';
  const emailRaw = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!name) return { error: 'Name is required' };
  // http(s) URL or a site-relative path like /photos/1290.png
  if (!/^(https?:\/\/|\/).+/.test(imageUrl)) {
    return { error: 'Image URL must be http(s) or a /path' };
  }
  if (emailRaw && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
    return { error: 'Email looks invalid' };
  }
  return { name, gender, imageUrl, email: emailRaw || null } as const;
}

export async function GET() {
  const session = await requireAdmin();
  if (isErrorResponse(session)) return session;
  return NextResponse.json({
    candidates: listCandidates(undefined, {
      round: getAppState().voting_round,
      includeUngendered: true,
      orderByName: true,
    }),
  });
}

export async function POST(req: Request) {
  const session = await requireAdmin();
  if (isErrorResponse(session)) return session;

  const body = await req.json().catch(() => ({}));
  const v = validateCandidate(body);
  if ('error' in v) return NextResponse.json({ error: v.error }, { status: 400 });
  if (v.email && getCandidateByEmail(v.email)) {
    return NextResponse.json(
      { error: 'A candidate with this email already exists — edit them instead' },
      { status: 409 }
    );
  }

  const candidate = createCandidate(v.name, v.gender, v.imageUrl, v.email);
  broadcast('candidates');
  return NextResponse.json({ ok: true, candidate });
}

export async function PUT(req: Request) {
  const session = await requireAdmin();
  if (isErrorResponse(session)) return session;

  const body = await req.json().catch(() => ({}));
  const id = typeof body.id === 'number' ? body.id : NaN;
  if (!getCandidate(id)) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });

  const v = validateCandidate(body);
  if ('error' in v) return NextResponse.json({ error: v.error }, { status: 400 });
  if (v.email) {
    const other = getCandidateByEmail(v.email);
    if (other && other.id !== id) {
      return NextResponse.json({ error: 'Another candidate already has this email' }, { status: 409 });
    }
  }

  updateCandidate(id, v.name, v.gender, v.imageUrl, v.email);
  broadcast('candidates');
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const session = await requireAdmin();
  if (isErrorResponse(session)) return session;

  const body = await req.json().catch(() => ({}));
  const id = typeof body.id === 'number' ? body.id : NaN;
  if (!getCandidate(id)) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });

  deleteCandidate(id);
  broadcast('candidates');
  return NextResponse.json({ ok: true });
}
