import Link from 'next/link';
import Header from './Header';
import BottomNav from './BottomNav';
import { Lock } from 'lucide-react';

interface Props { eventName: string; isAdmin: boolean }

export default function ModuleDisabled({ eventName, isAdmin }: Props) {
  return (
    <>
      <Header eventName={eventName} isAdmin={isAdmin} />
      <main className="max-w-lg mx-auto px-4 pt-24 flex flex-col items-center text-center gap-4 pb-10">
        <div className="w-20 h-20 rounded-3xl bg-slate-100 flex items-center justify-center">
          <Lock size={32} className="text-slate-300" />
        </div>
        <h2 className="text-xl font-extrabold text-slate-800">Module Disabled</h2>
        <p className="text-sm text-slate-400 max-w-xs">
          This section has been temporarily disabled by the admin. Check back later.
        </p>
        <Link href="/"
          className="mt-2 px-5 py-2.5 rounded-2xl text-sm font-bold text-white"
          style={{ background: 'linear-gradient(135deg,#FF7A00,#FF4F87)' }}>
          Go to Home
        </Link>
      </main>
      <BottomNav isAdmin={isAdmin} />
    </>
  );
}
