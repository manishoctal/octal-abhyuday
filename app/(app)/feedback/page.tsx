import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import Header from '@/components/Header';
import { getAppState, getModuleConfig, listFeedbackQuestions, getFeedbackSubmission, getSetting } from '@/lib/db';
import FeedbackClient from '@/components/FeedbackClient';
import ModuleDisabled from '@/components/ModuleDisabled';

export const dynamic = 'force-dynamic';

export default async function FeedbackPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const appState = getAppState();
  if (getModuleConfig().enabled.feedback === false)
    return <ModuleDisabled eventName={appState.event_name} isAdmin={session.isAdmin} />;

  const questions      = listFeedbackQuestions(true);
  const existing       = getFeedbackSubmission(session.id) ?? null;
  const editingAllowed = getSetting('feedback_editing_allowed') === '1';

  return (
    <>
      <Header eventName={appState.event_name} title="Feedback" isAdmin={session.isAdmin} />
      <main className="max-w-lg mx-auto px-4 pt-4">
        <FeedbackClient questions={questions} existing={existing} editingAllowed={editingAllowed} />
      </main>
    </>
  );
}
