import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import Header from '@/components/Header';
import { getAppState, listAwardCategories } from '@/lib/db';
import AdminAwardsModule from '@/components/admin/AwardsModule';

export const dynamic = 'force-dynamic';

export default async function AdminAwardsPage() {
  const session = await getSession();
  if (!session?.isAdmin) redirect('/');
  return (
    <>
      <Header eventName={getAppState().event_name} title="Awards" isAdmin back="/admin" />
      <main className="max-w-2xl mx-auto px-4 pt-4 pb-8">
        <AdminAwardsModule initial={listAwardCategories()} />
      </main>
    </>
  );
}
