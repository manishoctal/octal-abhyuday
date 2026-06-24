import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import Header from '@/components/Header';
import { getAppState, listFeedback } from '@/lib/db';
import AdminFeedbackModule from '@/components/admin/FeedbackModule';

export const dynamic = 'force-dynamic';

export default async function AdminFeedbackPage() {
  const session = await getSession();
  if (!session?.isAdmin) redirect('/');
  return (
    <>
      <Header eventName={getAppState().event_name} title="Feedback" isAdmin back="/admin" />
      <main className="max-w-2xl mx-auto px-4 pt-4 pb-8">
        <AdminFeedbackModule initial={listFeedback()} />
      </main>
    </>
  );
}
