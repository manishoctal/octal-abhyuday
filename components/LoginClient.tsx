'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

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
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong');
        return;
      }
      setStep('otp');
    } finally {
      setLoading(false);
    }
  }

  function handleOtpChange(i: number, value: string) {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...otp];
    next[i] = digit;
    setOtp(next);
    if (digit && i < 3) otpRefs.current[i + 1]?.focus();
  }

  function handleOtpKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !otp[i] && i > 0) {
      otpRefs.current[i - 1]?.focus();
    }
  }

  async function submitOtp(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const code = otp.join('');
    if (code.length < 4) {
      setError('Enter the 4-digit OTP');
      return;
    }
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
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-dvh flex items-center justify-center bg-gradient-to-br from-brand-700 via-brand-600 to-indigo-900 px-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <motion.div
            animate={{ rotate: [0, -8, 8, 0] }}
            transition={{ repeat: Infinity, duration: 4, repeatDelay: 2 }}
            className="text-6xl mb-3"
          >
            🏆
          </motion.div>
          <h1 className="text-3xl font-extrabold text-white">{eventName}</h1>
          <p className="text-brand-100 mt-1">Most Popular Male & Female</p>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl p-6 sm:p-8">
          {step === 'email' ? (
              <motion.form
                key="email"
                initial={{ opacity: 0, x: -24 }}
                animate={{ opacity: 1, x: 0 }}
                onSubmit={submitEmail}
                className="space-y-4"
              >
                <div>
                  <label htmlFor="email" className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Official Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="you@octalsoftware.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                    required
                  />
                  <p className="text-xs text-slate-500 mt-1.5">
                    Only @octalsoftware.com emails can sign in
                  </p>
                </div>
                {error && <p className="text-sm text-red-600 font-medium">{error}</p>}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-brand-600 py-3 text-white font-semibold text-base hover:bg-brand-700 active:scale-[0.98] transition disabled:opacity-60"
                >
                  {loading ? 'Sending…' : 'Send OTP'}
                </button>
              </motion.form>
            ) : (
              <motion.form
                key="otp"
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                onSubmit={submitOtp}
                className="space-y-5"
              >
                <div className="text-center">
                  <p className="text-sm text-slate-600">
                    Enter the 4-digit OTP sent to
                    <br />
                    <span className="font-semibold text-slate-900">{email}</span>
                  </p>
                </div>
                <div className="flex justify-center gap-3">
                  {otp.map((digit, i) => (
                    <input
                      key={i}
                      ref={(el) => {
                        otpRefs.current[i] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      aria-label={`OTP digit ${i + 1}`}
                      className="w-14 h-14 text-center text-2xl font-bold rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                    />
                  ))}
                </div>
                {error && <p className="text-sm text-red-600 font-medium text-center">{error}</p>}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-brand-600 py-3 text-white font-semibold text-base hover:bg-brand-700 active:scale-[0.98] transition disabled:opacity-60"
                >
                  {loading ? 'Verifying…' : 'Verify & Sign In'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStep('email');
                    setOtp(['', '', '', '']);
                    setError('');
                  }}
                  className="w-full text-sm text-slate-500 hover:text-slate-700"
                >
                  ← Change email
                </button>
              </motion.form>
            )}
        </div>

        <p className="text-center text-xs text-brand-200 mt-6">
          Octal IT Solutions · Internal voting platform
        </p>
      </motion.div>
    </main>
  );
}
