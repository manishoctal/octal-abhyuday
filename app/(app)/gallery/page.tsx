import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import Header from '@/components/Header';
import { getAppState, listPhotos, listUserPhotos, getModuleConfig } from '@/lib/db';
import { isS3Configured } from '@/lib/s3';
import GalleryClient from '@/components/GalleryClient';
import ModuleDisabled from '@/components/ModuleDisabled';

export const dynamic = 'force-dynamic';

export default async function GalleryPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const appState = getAppState();
  if (getModuleConfig().enabled.gallery === false)
    return <ModuleDisabled eventName={appState.event_name} isAdmin={session.isAdmin} />;

  return (
    <>
      <Header eventName={getAppState().event_name} title="Gallery" isAdmin={session.isAdmin} />
      <main className="max-w-lg mx-auto px-4 pt-4">
        <GalleryClient
          initialApproved={listPhotos(true)}
          initialMine={listUserPhotos(session.id)}
          userId={session.id}
          useS3={isS3Configured()}
        />
      </main>

    </>
  );
}
