import { getSetting } from '@/lib/db';
import AppReleaseModule from '@/components/admin/AppReleaseModule';

export const dynamic = 'force-dynamic';

export default function AppReleasePage() {
  return (
    <AppReleaseModule
      initial={{
        downloadUrl:    getSetting('apk_url')              ?? '',
        versionName:    getSetting('apk_version_name')     ?? '',
        versionCode:    getSetting('apk_version_code')     ?? '',
        minVersionCode: getSetting('apk_min_version_code') ?? '',
        releaseNotes:   getSetting('apk_release_notes')    ?? '',
      }}
    />
  );
}
