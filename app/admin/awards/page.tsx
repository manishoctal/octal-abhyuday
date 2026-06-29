import { listAwardCategories } from '@/lib/db';
import AdminAwardsModule from '@/components/admin/AwardsModule';

export const dynamic = 'force-dynamic';

export default function AdminAwardsPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-slate-900">🏆 Awards</h1>
        <p className="text-sm text-slate-500 mt-1">Manage award categories, nominees, and reveal winners with confetti during the ceremony.</p>
      </div>
      <AdminAwardsModule initial={listAwardCategories()} />
    </div>
  );
}
