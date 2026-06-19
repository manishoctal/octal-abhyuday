import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import StageClient from '@/components/StageClient';

export const dynamic = 'force-dynamic';

/** Projector / big-screen presenter view. Admin-only: the machine driving the
 *  stage display signs in with an admin account. */
export default async function StagePage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!session.isAdmin) redirect('/');

  return <StageClient />;
}
