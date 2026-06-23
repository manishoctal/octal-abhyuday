'use client';

import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';

interface Props {
  userId: number;
  name: string;
  email: string;
  department: string | null;
  isCheckedIn: boolean;
  eventName: string;
}

export default function MyQrClient({ userId, name, email, department, isCheckedIn: initial, eventName }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [checkedIn, setCheckedIn] = useState(initial);

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, String(userId), {
      width: 240,
      margin: 2,
      color: { dark: '#1e293b', light: '#ffffff' },
    });
  }, [userId]);

  // Poll for check-in status
  useEffect(() => {
    if (checkedIn) return;
    const t = setInterval(async () => {
      const res = await fetch('/api/attendance');
      if (res.ok) {
        const d = await res.json();
        if (d.record) { setCheckedIn(true); clearInterval(t); }
      }
    }, 5000);
    return () => clearInterval(t);
  }, [checkedIn]);

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Badge card */}
      <div className="w-full max-w-xs rounded-3xl border-2 border-slate-200 bg-white shadow-xl overflow-hidden">
        <div className="bg-gradient-to-br from-brand-600 to-violet-600 px-4 py-4 text-center">
          <p className="text-white font-extrabold text-lg leading-tight">{eventName}</p>
          <p className="text-indigo-200 text-xs mt-0.5">Event Badge</p>
        </div>
        <div className="flex flex-col items-center px-6 py-5 gap-3">
          <canvas ref={canvasRef} className="rounded-xl" />
          <div className="text-center">
            <p className="font-bold text-slate-900 text-lg">{name}</p>
            {department && <p className="text-sm text-slate-500">{department}</p>}
            <p className="text-xs text-slate-400 mt-0.5">{email}</p>
          </div>
          {checkedIn ? (
            <div className="flex items-center gap-2 bg-green-50 text-green-700 rounded-full px-4 py-1.5 text-sm font-bold">
              <span>✅</span> Checked in!
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-slate-100 text-slate-500 rounded-full px-4 py-1.5 text-sm font-semibold">
              <span className="animate-pulse">⏳</span> Waiting for check-in
            </div>
          )}
        </div>
      </div>

      <p className="text-xs text-slate-400 text-center max-w-xs">
        Show this QR code to the event host at the entrance. Once scanned, your attendance is recorded.
      </p>
    </div>
  );
}
