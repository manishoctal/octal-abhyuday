import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import Header from '@/components/Header';
import { getAppState, listPhotos } from '@/lib/db';
import AdminPhotosModule from '@/components/admin/PhotosModule';

export const dynamic = 'force-dynamic';

export default async function AdminPhotosPage() {
  const session = await getSession();
  if (!session?.isAdmin) redirect('/');
  return (
    <>
      <Header eventName={getAppState().event_name} title="Photos" isAdmin back="/admin" />
      <main className="max-w-2xl mx-auto px-4 pt-4 pb-8">
        <AdminPhotosModule initial={listPhotos(false)} />
      </main>
    </>
  );
}
