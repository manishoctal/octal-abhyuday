import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { getAppState } from '@/lib/db';
import MyPhotosClient from '@/components/MyPhotosClient';

export const dynamic = 'force-dynamic';

export default async function MyPhotosPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <>
      <Header eventName={getAppState().event_name} title="My Photos" isAdmin={session.isAdmin} />
      <main className="max-w-lg mx-auto px-4 pt-4">
        <MyPhotosClient />
      </main>
      <BottomNav isAdmin={session.isAdmin} />
    </>
  );
}
