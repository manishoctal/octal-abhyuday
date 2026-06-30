import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import Header from '@/components/Header';
import { getAppState, getAttendance, getEmployeeByEmail, getRoomForEmployee, getModuleConfig } from '@/lib/db';
import MyQrClient from '@/components/MyQrClient';
import RoomCard from '@/components/RoomCard';

export const dynamic = 'force-dynamic';

export default async function MePage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const appState      = getAppState();
  const attendance    = getAttendance(session.id);
  const emp           = getEmployeeByEmail(session.email);
  const room          = emp ? getRoomForEmployee(emp.id) : null;
  const moduleConfig  = getModuleConfig();
  const checkinEnabled = moduleConfig.enabled['badge'] !== false;

  return (
    <>
      <Header eventName={appState.event_name} title="My Badge" isAdmin={session.isAdmin} />
      <main className="max-w-lg mx-auto px-4 pt-6">
        <MyQrClient
          userId={session.id}
          name={session.name}
          email={session.email}
          isCheckedIn={!!attendance}
          eventName={appState.event_name}
          photoUrl={emp?.profile_photo_url}
          checkinEnabled={checkinEnabled}
        />

        {room && <RoomCard room={room} />}

        {/* Aadhar Card */}
        {emp && (
          <Link
            href="/aadhar"
            className="card mt-4 px-5 py-4 flex items-center justify-between active:scale-[0.99] transition-transform"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: '#EEF2FF' }}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <rect x="2" y="4" width="16" height="12" rx="2" stroke="#6366F1" strokeWidth="1.6"/>
                  <circle cx="7" cy="9" r="2" stroke="#6366F1" strokeWidth="1.4"/>
                  <path d="M4 14c0-1.7 1.3-2.5 3-2.5s3 .8 3 2.5" stroke="#6366F1" strokeWidth="1.4" strokeLinecap="round"/>
                  <path d="M13 8h3M13 10.5h2M13 13h3" stroke="#6366F1" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
              </div>
              <div>
                <p className="font-semibold text-slate-900 text-[15px]">Aadhar Card</p>
                <p className="text-xs text-slate-400">Upload front &amp; back for records</p>
              </div>
            </div>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M7 4l5 5-5 5" stroke="#94A3B8" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Link>
        )}


        {/* My Profile */}
        <Link
          href="/profile"
          className="card mt-4 px-5 py-4 flex items-center justify-between active:scale-[0.99] transition-transform"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: '#FFF4E8' }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="6.5" r="3" stroke="#FE9234" strokeWidth="1.6"/>
                <path d="M4 16c0-2.8 2.7-4.5 6-4.5s6 1.7 6 4.5" stroke="#FE9234" strokeWidth="1.6" strokeLinecap="round"/>
              </svg>
            </div>
            <div>
              <p className="font-semibold text-slate-900 text-[15px]">My Profile</p>
              <p className="text-xs text-slate-400">Update your photo</p>
            </div>
          </div>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M7 4l5 5-5 5" stroke="#94A3B8" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </Link>
      </main>

    </>
  );
}
