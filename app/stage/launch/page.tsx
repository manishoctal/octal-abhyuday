import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getAppState, getSetting } from '@/lib/db';
import LaunchStageClient from '@/components/LaunchStageClient';

export const dynamic = 'force-dynamic';

/** Full-screen launch countdown for projector / big screen.
 *  Navigate here before the event starts — it auto-launches the celebration. */
export default async function LaunchStagePage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!session.isAdmin) redirect('/');

  const { event_name } = getAppState();
  const eventDate = getSetting('event_date') ?? '2026-07-04T09:00:00';

  return (
    <LaunchStageClient eventName={event_name} eventDate={eventDate} />
  );
}
