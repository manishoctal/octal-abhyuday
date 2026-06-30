import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import BottomNav from '@/components/BottomNav';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <>
      {children}
      <BottomNav isAdmin={session.isAdmin} />
    </>
  );
}
