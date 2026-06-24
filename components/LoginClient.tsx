'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginClient({ eventName }: { eventName: string }) {
  const router = useRouter();
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (step === 'otp') otpRefs.current[0]?.focus();
  }, [step]);

  async function submitEmail(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!email.trim().toLowerCase().endsWith('@octalsoftware.com')) {
      setError('Please use your official @octalsoftware.com email');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Something went wrong'); return; }
      setStep('otp');
    } finally { setLoading(false); }
  }

  function handleOtpChange(i: number, value: string) {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...otp];
    next[i] = digit;
    setOtp(next);
    if (digit && i < 3) otpRefs.current[i + 1]?.focus();
  }

  function handleOtpKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !otp[i] && i > 0) otpRefs.current[i - 1]?.focus();
  }

  async function submitOtp(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const code = otp.join('');
    if (code.length < 4) { setError('Enter the 4-digit OTP'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), otp: code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Invalid OTP');
        setOtp(['', '', '', '']);
        otpRefs.current[0]?.focus();
        return;
      }
      router.replace(data.isAdmin ? '/admin' : '/');
      router.refresh();
    } finally { setLoading(false); }
  }

  return (
    <main
      className="min-h-dvh flex flex-col items-center justify-center px-5 py-10"
      style={{ background: '#F8FAFC' }}
    >
      {/* Wordmark / hero */}
      <div className="w-full max-w-sm text-center mb-8">
        {/* Octal logo mark */}
        <div
          className="w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-5 shadow-brand-sm"
          style={{ background: '#FE9234' }}
        >
          <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
            <text x="3" y="23" fontSize="22" fontWeight="800" fill="white" fontFamily="system-ui">O</text>
          </svg>
        </div>
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">Octal IT Solution</p>
        <h1 className="text-3xl font-bold text-slate-900 mt-1 tracking-tight">{eventName}</h1>
        <p className="text-slate-400 text-sm mt-1.5">Sign in with your work email</p>
      </div>

      {/* Card */}
      <div className="card w-full max-w-sm p-6">
        {step === 'email' ? (
          <form onSubmit={submitEmail} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-slate-700 mb-1.5">
                Work Email
              </label>
              <input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@octalsoftware.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="input"
                required
              />
              <p className="text-[11px] text-slate-400 mt-1.5">Only @octalsoftware.com emails allowed</p>
            </div>
            {error && (
              <div className="bg-red-50 text-red-600 text-sm font-medium px-4 py-2.5 rounded-xl">{error}</div>
            )}
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Sending OTP…' : 'Continue'}
            </button>
          </form>
        ) : (
          <form onSubmit={submitOtp} className="space-y-5">
            <div className="text-center">
              <p className="text-sm text-slate-500">
                Enter the 4-digit OTP sent to
              </p>
              <p className="font-semibold text-slate-900 mt-0.5">{email}</p>
            </div>

            {/* OTP inputs */}
            <div className="flex justify-center gap-3">
              {otp.map((digit, i) => (
                <input
                  key={i}
                  ref={el => { otpRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={e => handleOtpChange(i, e.target.value)}
                  onKeyDown={e => handleOtpKeyDown(i, e)}
                  aria-label={`OTP digit ${i + 1}`}
                  className="w-14 h-14 text-center text-2xl font-bold rounded-2xl border-2 outline-none transition-colors"
                  style={{
                    borderColor: digit ? '#FE9234' : '#E2E8F0',
                    background: digit ? '#FFF4E8' : '#F8FAFC',
                    color: '#0F172A',
                  }}
                />
              ))}
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 text-sm font-medium px-4 py-2.5 rounded-xl text-center">{error}</div>
            )}

            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Verifying…' : 'Sign In'}
            </button>

            <button
              type="button"
              onClick={() => { setStep('email'); setOtp(['', '', '', '']); setError(''); }}
              className="w-full text-sm text-slate-400 hover:text-slate-600 transition-colors py-1"
            >
              ← Change email
            </button>
          </form>
        )}
      </div>

      <p className="text-[11px] text-slate-400 mt-8 text-center">
        Octal IT Solution LLP · Internal Event Platform
      </p>
    </main>
  );
}
