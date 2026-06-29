import QuickLaunch from '@/components/admin/QuickLaunch';

export const dynamic = 'force-dynamic';

export default function AdminPollsPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-slate-900">📊 Live Polls</h1>
        <p className="text-sm text-slate-500 mt-1">
          One question, instant launch — voters see the results live as they come in.
        </p>
      </div>
      <QuickLaunch kind="poll" />
    </div>
  );
}
