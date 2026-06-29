import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getAppState } from '@/lib/db';
import AdminShell from '@/components/admin/AdminShell';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!session.isAdmin) redirect('/');

  const { event_name } = getAppState();

  return (
    <AdminShell eventName={event_name} adminName={session.name}>
      {children}
    </AdminShell>
  );
}
