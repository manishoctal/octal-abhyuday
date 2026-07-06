import { listFeedbackQuestions } from '@/lib/db';
import AdminFeedbackModule from '@/components/admin/FeedbackModule';

export const dynamic = 'force-dynamic';

export default function AdminFeedbackPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-slate-900">⭐ Feedback</h1>
        <p className="text-sm text-slate-500 mt-1">Manage feedback questions and view employee responses.</p>
      </div>
      <AdminFeedbackModule initialQuestions={listFeedbackQuestions(false)} />
    </div>
  );
}
