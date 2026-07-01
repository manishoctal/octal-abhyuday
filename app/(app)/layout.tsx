import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import BottomNav from '@/components/BottomNav';
import BfcacheGuard from '@/components/BfcacheGuard';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <>
      <BfcacheGuard />
      {children}
      <BottomNav isAdmin={session.isAdmin} />
    </>
  );
}
