import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { getAppState, getAttendance, getUserById, getEmployeeByEmail, getRoomForEmployee, getAadharByEmployee } from '@/lib/db';
import { isS3Configured } from '@/lib/s3';
import MyQrClient from '@/components/MyQrClient';
import RoomCard from '@/components/RoomCard';
import AadharUploadClient from '@/components/AadharUploadClient';

export const dynamic = 'force-dynamic';

export default async function MePage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const appState = getAppState();
  const user = getUserById(session.id);
  const attendance = getAttendance(session.id);
  const emp    = getEmployeeByEmail(session.email);
  const room   = emp ? getRoomForEmployee(emp.id) : null;
  const aadhar = emp ? getAadharByEmployee(emp.id) : null;

  return (
    <>
      <Header eventName={appState.event_name} title="My Badge" isAdmin={session.isAdmin} />
      <main className="max-w-lg mx-auto px-4 pt-6">
        <MyQrClient
          userId={session.id}
          name={session.name}
          email={session.email}
          department={user?.department ?? null}
          isCheckedIn={!!attendance}
          eventName={appState.event_name}
        />


        {room && <RoomCard room={room} />}

        {emp && <AadharUploadClient initial={aadhar} useS3={isS3Configured()} />}

        <Link
          href="/my-photos"
          className="card mt-4 px-5 py-4 flex items-center justify-between active:scale-[0.99] transition-transform"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: '#FFF4E8' }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="8" r="3" stroke="#FE9234" strokeWidth="1.6"/>
                <rect x="3" y="4" width="14" height="11" rx="2" stroke="#FE9234" strokeWidth="1.6"/>
                <circle cx="15.5" cy="5.5" r="1.5" fill="#FE9234"/>
              </svg>
            </div>
            <div>
              <p className="font-semibold text-slate-900 text-[15px]">My Photos</p>
              <p className="text-xs text-slate-400">Find yourself in event gallery</p>
            </div>
          </div>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M7 4l5 5-5 5" stroke="#94A3B8" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </Link>

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
              <p className="text-xs text-slate-400">Department & photo</p>
            </div>
          </div>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M7 4l5 5-5 5" stroke="#94A3B8" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </Link>
      </main>
      <BottomNav isAdmin={session.isAdmin} />
    </>
  );
}
