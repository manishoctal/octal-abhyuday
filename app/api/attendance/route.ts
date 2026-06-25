import { NextResponse } from 'next/server';
import { requireAdmin, requireUser, isErrorResponse } from '@/lib/api-helpers';
import { checkIn, selfCheckIn, getAttendance, listAttendance, awardPoints, getVenueConfig } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Haversine distance in metres between two lat/lng points
function haversineMetres(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get('list') === '1') {
    const adminOrErr = await requireAdmin();
    if (isErrorResponse(adminOrErr)) return adminOrErr;
    const rows = listAttendance();
    if (url.searchParams.get('format') === 'csv') {
      const csv = [
        'Name,Email,Department,Checked In At,Lat,Lng,Distance(m)',
        ...rows.map((r) =>
          `"${r.name}","${r.email}","${r.department ?? ''}","${r.checked_in_at}","${r.lat ?? ''}","${r.lng ?? ''}","${r.distance_m != null ? Math.round(r.distance_m) : ''}"`
        ),
      ].join('\n');
      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="attendance.csv"',
        },
      });
    }
    return NextResponse.json({ attendance: rows, total: rows.length });
  }
  const userOrErr = await requireUser();
  if (isErrorResponse(userOrErr)) return userOrErr;
  return NextResponse.json({ record: getAttendance(userOrErr.id) });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  // ── Admin QR-scan path (legacy) ──────────────────────────────
  if ('userId' in body) {
    const adminOrErr = await requireAdmin();
    if (isErrorResponse(adminOrErr)) return adminOrErr;
    const { userId } = body as { userId: number };
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });
    const result = checkIn(Number(userId));
    if (result.changes > 0) awardPoints(Number(userId), 'check_in', 15);
    return NextResponse.json({ ok: true, alreadyCheckedIn: result.changes === 0 });
  }

  // ── Employee self-check-in path ───────────────────────────────
  const userOrErr = await requireUser();
  if (isErrorResponse(userOrErr)) return userOrErr;

  const { lat, lng } = body as { lat?: number; lng?: number };
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return NextResponse.json({ error: 'Location is required to check in.' }, { status: 400 });
  }

  const venue = getVenueConfig();

  // If venue is not configured yet, allow check-in without distance check
  if (venue.lat === null || venue.lng === null) {
    const result = selfCheckIn(userOrErr.id, lat, lng, 0);
    if (result.changes > 0) awardPoints(userOrErr.id, 'check_in', 15);
    return NextResponse.json({ ok: true, alreadyCheckedIn: result.changes === 0, distanceM: 0, venueConfigured: false });
  }

  const distanceM = haversineMetres(lat, lng, venue.lat, venue.lng);
  const radiusM = venue.radius_km * 1000;

  if (distanceM > radiusM) {
    return NextResponse.json(
      {
        ok: false,
        error: `You are ${Math.round(distanceM)} m from the venue. Must be within ${Math.round(radiusM)} m to check in.`,
        distanceM: Math.round(distanceM),
        radiusM: Math.round(radiusM),
      },
      { status: 403 }
    );
  }

  const result = selfCheckIn(userOrErr.id, lat, lng, Math.round(distanceM));
  if (result.changes > 0) awardPoints(userOrErr.id, 'check_in', 15);
  return NextResponse.json({
    ok: true,
    alreadyCheckedIn: result.changes === 0,
    distanceM: Math.round(distanceM),
    radiusM: Math.round(radiusM),
    venueConfigured: true,
  });
}
