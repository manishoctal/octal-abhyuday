import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getAppState } from '@/lib/db';
import VotingStageClient from '@/components/VotingStageClient';

export const dynamic = 'force-dynamic';

/** Full-screen projector view for Popularity Voting — admin-only. */
export default async function VotingStagePage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!session.isAdmin) redirect('/');

  const { event_name } = getAppState();
  return <VotingStageClient eventName={event_name} />;
}
