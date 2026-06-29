import { NextResponse } from 'next/server';
import { requireAdmin, isErrorResponse } from '@/lib/api-helpers';
import { getVenueConfig, setVenueConfig, getCheckinToken, regenerateCheckinToken } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const adminOrErr = await requireAdmin();
  if (isErrorResponse(adminOrErr)) return adminOrErr;
  return NextResponse.json({ ...getVenueConfig(), checkin_token: getCheckinToken() });
}

export async function PATCH(req: Request) {
  const adminOrErr = await requireAdmin();
  if (isErrorResponse(adminOrErr)) return adminOrErr;
  const { action } = await req.json().catch(() => ({})) as { action?: string };
  if (action !== 'regenerate_token') return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  const token = regenerateCheckinToken();
  return NextResponse.json({ ok: true, checkin_token: token });
}

export async function POST(req: Request) {
  const adminOrErr = await requireAdmin();
  if (isErrorResponse(adminOrErr)) return adminOrErr;

  const { lat, lng, radius_km } = await req.json().catch(() => ({}));

  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return NextResponse.json({ error: 'lat and lng are required numbers.' }, { status: 400 });
  }
  if (lat < -90 || lat > 90)   return NextResponse.json({ error: 'lat must be between -90 and 90.' }, { status: 400 });
  if (lng < -180 || lng > 180) return NextResponse.json({ error: 'lng must be between -180 and 180.' }, { status: 400 });

  const radius = typeof radius_km === 'number' && radius_km > 0 ? radius_km : 0.5;
  setVenueConfig(lat, lng, radius);
  return NextResponse.json({ ok: true });
}
