import { NextResponse } from 'next/server';
import { requireAdmin, isErrorResponse } from '@/lib/api-helpers';
import { setSetting } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const adminOrErr = await requireAdmin();
  if (isErrorResponse(adminOrErr)) return adminOrErr;

  const { downloadUrl, versionName, versionCode, minVersionCode, releaseNotes } =
    await req.json();

  setSetting('apk_url',              downloadUrl    ?? '');
  setSetting('apk_version_name',     versionName    ?? '');
  setSetting('apk_version_code',     String(versionCode    ?? ''));
  setSetting('apk_min_version_code', String(minVersionCode ?? ''));
  setSetting('apk_release_notes',    releaseNotes   ?? '');

  return NextResponse.json({ ok: true });
}
