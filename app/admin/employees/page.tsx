import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import Header from '@/components/Header';
import { getAppState, listEmployees } from '@/lib/db';
import EmployeesModule from '@/components/admin/EmployeesModule';

export const dynamic = 'force-dynamic';

export default async function AdminEmployeesPage() {
  const session = await getSession();
  if (!session?.isAdmin) redirect('/login');

  const employees = listEmployees();

  return (
    <>
      <Header name={session.name} eventName={getAppState().event_name} isAdmin={session.isAdmin} />
      <main className="max-w-2xl mx-auto px-4 pt-4 pb-24">
        <div className="mb-4">
          <Link href="/admin" className="text-sm font-semibold text-brand-600 hover:text-brand-700">← All modules</Link>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1">👥 Employee Roster</h1>
          <p className="text-sm text-slate-500 mt-0.5">Only employees added here can log in. Upload photo, set employee code, name and email.</p>
        </div>
        <EmployeesModule initial={employees} />
      </main>
    </>
  );
}
