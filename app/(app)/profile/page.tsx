import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import Header from '@/components/Header';
import { getAppState, getUserById } from '@/lib/db';
import { isS3Configured } from '@/lib/s3';
import ProfileClient from '@/components/ProfileClient';

export const dynamic = 'force-dynamic';

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: { required?: string };
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  const appState = getAppState();
  const user = getUserById(session.id);
  const required = searchParams.required === '1';

  return (
    <>
      <Header
        eventName={appState.event_name}
        title={required ? 'Complete Profile' : 'My Profile'}
        isAdmin={session.isAdmin}
        hideBack={required}
      />
      <main className="max-w-lg mx-auto px-4 pt-6">
        <ProfileClient
          name={user?.name ?? session.name}
          email={user?.email ?? session.email}
          profilePhotoUrl={user?.profile_photo_url ?? null}
          required={required}
          useS3={isS3Configured()}
        />
      </main>

    </>
  );
}
