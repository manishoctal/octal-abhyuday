import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { listEmployeesWithFaceStatus } from '@/lib/db';
import EmployeesModule from '@/components/admin/EmployeesModule';

export const dynamic = 'force-dynamic';

export default async function AdminEmployeesPage() {
  const session = await getSession();
  if (!session?.isAdmin) redirect('/');
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-slate-900">👥 Employee Roster</h1>
        <p className="text-sm text-slate-500 mt-1">Only employees added here can log in. Upload photo, set employee code, name and email.</p>
      </div>
      <EmployeesModule initial={listEmployeesWithFaceStatus()} />
    </div>
  );
}
