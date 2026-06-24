'use client';

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-4 text-center">
      <div className="text-5xl mb-4">📡</div>
      <h1 className="text-xl font-extrabold text-slate-900 mb-2">You&apos;re offline</h1>
      <p className="text-slate-500 text-sm max-w-xs">
        Check your connection and try again. The schedule you last viewed may still be available.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="mt-6 px-5 py-2.5 rounded-full bg-brand-600 text-white font-semibold text-sm hover:bg-brand-700 transition"
      >
        Try again
      </button>
    </div>
  );
}
