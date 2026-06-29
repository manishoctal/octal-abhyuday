import QuickLaunch from '@/components/admin/QuickLaunch';

export const dynamic = 'force-dynamic';

export default function AdminRankingPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-slate-900">🏅 Rankings</h1>
        <p className="text-sm text-slate-500 mt-1">
          Everyone orders the options on their phone — watch the combined crowd ranking form live.
        </p>
      </div>
      <QuickLaunch kind="ranking" />
    </div>
  );
}
