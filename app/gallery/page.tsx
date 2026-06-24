import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { getAppState, listPhotos, listUserPhotos } from '@/lib/db';
import GalleryClient from '@/components/GalleryClient';

export const dynamic = 'force-dynamic';

export default async function GalleryPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <>
      <Header eventName={getAppState().event_name} title="Gallery" isAdmin={session.isAdmin} />
      <main className="max-w-lg mx-auto px-4 pt-4">
        <GalleryClient
          initialApproved={listPhotos(true)}
          initialMine={listUserPhotos(session.id)}
          userId={session.id}
        />
      </main>
      <BottomNav isAdmin={session.isAdmin} />
    </>
  );
}
