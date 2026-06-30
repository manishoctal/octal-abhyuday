import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import Header from '@/components/Header';
import { getAppState, getEmployeeByEmail, getAadharByEmployee } from '@/lib/db';
import { isS3Configured } from '@/lib/s3';
import AadharUploadClient from '@/components/AadharUploadClient';

export const dynamic = 'force-dynamic';

export default async function AadharPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const appState = getAppState();
  const emp = getEmployeeByEmail(session.email);
  if (!emp) redirect('/me');

  const aadhar = getAadharByEmployee(emp.id);

  return (
    <>
      <Header eventName={appState.event_name} title="Aadhar Card" isAdmin={session.isAdmin} />
      <main className="max-w-lg mx-auto px-4 pt-6 pb-28">
        <p className="text-sm text-slate-500 mb-4">
          Upload the front and back of your Aadhar card. This is stored securely for event records only.
        </p>
        <AadharUploadClient initial={aadhar} useS3={isS3Configured()} />
      </main>

    </>
  );
}
