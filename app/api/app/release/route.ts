import { NextResponse } from 'next/server';
import { getSetting } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const versionCode    = getSetting('apk_version_code');
  const minVersionCode = getSetting('apk_min_version_code');

  return NextResponse.json({
    downloadUrl:    getSetting('apk_url')          ?? null,
    versionName:    getSetting('apk_version_name') ?? null,
    versionCode:    versionCode    ? Number.parseInt(versionCode, 10)    : null,
    minVersionCode: minVersionCode ? Number.parseInt(minVersionCode, 10) : null,
    releaseNotes:   getSetting('apk_release_notes') ?? null,
  });
}
