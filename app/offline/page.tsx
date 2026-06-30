'use client';

import { useEffect, useState } from 'react';

export default function OfflinePage() {
  const [dots, setDots] = useState('');

  useEffect(() => {
    const t = setInterval(() => setDots(d => (d.length >= 3 ? '' : d + '.')), 500);
    return () => clearInterval(t);
  }, []);

  return (
    <div
      className="min-h-dvh flex flex-col items-center justify-center px-6 text-center"
      style={{ background: 'linear-gradient(160deg,#0F1035 0%,#1E1B4B 60%,#09091a 100%)' }}
    >
      <div className="relative mb-8">
        <div
          className="w-24 h-24 rounded-3xl flex items-center justify-center shadow-2xl"
          style={{ background: 'linear-gradient(135deg,#FE9234,#FF4F87)' }}
        >
          <span className="text-5xl select-none">🚀</span>
        </div>
        <span
          className="absolute inset-0 rounded-3xl animate-ping opacity-20"
          style={{ background: 'linear-gradient(135deg,#FE9234,#FF4F87)' }}
        />
      </div>

      <h1 className="text-2xl font-black text-white mb-2 tracking-tight">
        We&apos;re upgrading for you
        <span className="inline-block w-8 text-left">{dots}</span>
      </h1>

      <p className="text-slate-400 text-sm leading-relaxed max-w-xs mb-8">
        Our server is getting a fresh update with the latest improvements.
        This usually takes just a minute — hang tight!
      </p>

      <div className="w-full max-w-xs space-y-3 mb-10">
        {[
          { icon: '⚡', label: 'Performance boost' },
          { icon: '✨', label: 'New features landing' },
          { icon: '🔒', label: 'Security updates' },
        ].map(({ icon, label }) => (
          <div
            key={label}
            className="flex items-center gap-3 rounded-2xl px-4 py-3"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <span className="text-xl">{icon}</span>
            <span className="text-sm font-semibold text-slate-300">{label}</span>
          </div>
        ))}
      </div>

      <button
        onClick={() => window.location.reload()}
        className="h-12 px-8 rounded-2xl text-white font-bold text-[15px] transition-opacity active:opacity-80"
        style={{ background: 'linear-gradient(135deg,#FE9234,#FF4F87)' }}
      >
        Try again
      </button>

      <p className="mt-4 text-xs text-slate-600">
        Octal IT Solution LLP &middot; ABHYUDAY 2026
      </p>
    </div>
  );
}
