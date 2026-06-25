'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Hash, ChevronLeft, Sparkles } from 'lucide-react';

const SPARKLES_POS = [
  { top: '8%',  left: '6%',  d: 0 },
  { top: '14%', right: '10%', d: 0.6 },
  { top: '48%', right: '5%', d: 1.2 },
  { top: '34%', left: '4%',  d: 0.9 },
  { top: '74%', right: '18%',d: 1.7 },
  { top: '80%', left: '44%', d: 1.0 },
];

export default function LoginClient({ eventName }: { eventName: string }) {
  const [step, setStep]         = useState<'code' | 'otp'>('code');
  const [employeeCode, setCode] = useState('');
  const [otp, setOtp]           = useState(['', '', '', '']);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const codeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === 'otp') otpRefs.current[0]?.focus();
    if (step === 'code') codeInputRef.current?.focus();
  }, [step]);

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!employeeCode.trim()) { setError('Please enter your employee code.'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_code: employeeCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Something went wrong.'); return; }
      setStep('otp');
    } finally { setLoading(false); }
  }

  function handleOtpChange(i: number, value: string) {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...otp]; next[i] = digit; setOtp(next);
    if (digit && i < 3) otpRefs.current[i + 1]?.focus();
  }

  function handleOtpKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !otp[i] && i > 0) otpRefs.current[i - 1]?.focus();
    if (e.key === 'ArrowLeft' && i > 0) otpRefs.current[i - 1]?.focus();
    if (e.key === 'ArrowRight' && i < 3) otpRefs.current[i + 1]?.focus();
  }

  function handleOtpPaste(e: React.ClipboardEvent) {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    if (text.length === 4) {
      e.preventDefault();
      setOtp(text.split(''));
      otpRefs.current[3]?.focus();
    }
  }

  async function submitOtp(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const code = otp.join('');
    if (code.length < 4) { setError('Enter all 4 digits.'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_code: employeeCode.trim(), otp: code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Invalid OTP.');
        setOtp(['', '', '', '']);
        otpRefs.current[0]?.focus();
        return;
      }
      window.location.href = data.isAdmin ? '/admin' : '/';
    } finally { setLoading(false); }
  }

  async function resendOtp() {
    setError(''); setOtp(['', '', '', '']); setLoading(true);
    try {
      const res = await fetch('/api/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_code: employeeCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? 'Could not resend OTP.');
    } finally { setLoading(false); }
  }

  return (
    <main className="min-h-dvh flex flex-col relative overflow-hidden"
      style={{ background: 'linear-gradient(150deg,#050314 0%,#0F1035 30%,#1E1B4B 65%,#080D2A 100%)' }}>

      {/* Ambient glows */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute w-96 h-96 rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle,rgba(107,78,255,0.30),transparent)', top: '-15%', right: '-10%' }} />
        <div className="absolute w-72 h-72 rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle,rgba(255,122,0,0.22),transparent)', bottom: '5%', left: '-8%' }} />
        <div className="absolute w-48 h-48 rounded-full blur-2xl"
          style={{ background: 'radial-gradient(circle,rgba(255,79,135,0.18),transparent)', top: '40%', left: '40%' }} />
      </div>

      {/* Sparkle dots */}
      {SPARKLES_POS.map((p, i) => (
        <motion.div key={i}
          className="absolute w-[3px] h-[3px] rounded-full bg-white pointer-events-none"
          style={{ top: p.top, left: (p as {left?:string}).left, right: (p as {right?:string}).right }}
          animate={{ opacity: [0.12, 0.8, 0.12], scale: [0.8, 1.5, 0.8] }}
          transition={{ repeat: Infinity, duration: 2.8, delay: p.d }} />
      ))}

      <div className="relative z-10 flex flex-col items-center justify-center flex-1 px-5 py-12">

        {/* Hero */}
        <motion.div className="text-center mb-8"
          initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="w-[72px] h-[72px] rounded-[22px] flex items-center justify-center mx-auto mb-5 shadow-lg"
            style={{ background: 'linear-gradient(135deg,#FF7A00,#FF4F87,#6B4EFF)',
                     boxShadow: '0 0 30px rgba(255,122,0,0.40)' }}>
            <span className="text-white font-black text-3xl leading-none">A</span>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] mb-1"
            style={{ color: 'rgba(251,146,60,0.65)' }}>Octal IT Solutions</p>
          <h1 className="text-[32px] font-black text-white leading-none tracking-[-1.5px]">{eventName}</h1>
          <p className="text-[13px] mt-2 font-medium" style={{ color: 'rgba(255,255,255,0.38)' }}>
            Sign in with your employee code
          </p>
        </motion.div>

        {/* Card */}
        <motion.div className="w-full max-w-sm rounded-[28px] overflow-hidden"
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
          style={{ background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(24px)',
                   WebkitBackdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.12)',
                   boxShadow: '0 24px 64px rgba(0,0,0,0.4)' }}>

          <AnimatePresence mode="wait">
            {step === 'code' ? (
              <motion.form key="code" onSubmit={submitCode}
                initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                className="p-7 space-y-5">

                <div className="space-y-1">
                  <h2 className="text-white font-bold text-[18px]">Welcome</h2>
                  <p className="text-[13px]" style={{ color: 'rgba(255,255,255,0.40)' }}>
                    Enter your employee code to receive an OTP on your registered email
                  </p>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5"
                    style={{ color: 'rgba(255,255,255,0.45)' }}>Employee Code</label>
                  <div className="flex items-center rounded-[14px] overflow-hidden"
                    style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)' }}>
                    <Hash size={15} className="ml-3.5 shrink-0" style={{ color: 'rgba(255,255,255,0.35)' }} />
                    <input
                      ref={codeInputRef}
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="e.g. 1423"
                      value={employeeCode}
                      onChange={e => setCode(e.target.value)}
                      className="flex-1 px-3 py-3.5 text-sm bg-transparent outline-none text-white placeholder-white/30"
                    />
                  </div>
                </div>

                {error && (
                  <div className="rounded-[12px] px-4 py-3 text-sm font-medium"
                    style={{ background: 'rgba(239,68,68,0.15)', color: '#FCA5A5', border: '1px solid rgba(239,68,68,0.25)' }}>
                    {error}
                  </div>
                )}

                <button type="submit" disabled={loading}
                  className="w-full py-[14px] rounded-[14px] font-black text-white text-[15px] flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg,#FF7A00,#FF4F87)',
                           boxShadow: '0 8px 24px rgba(255,122,0,0.38)' }}>
                  {loading ? (
                    <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : (
                    <><span>Send OTP</span><ArrowRight size={16} strokeWidth={2.5} /></>
                  )}
                </button>
              </motion.form>
            ) : (
              <motion.form key="otp" onSubmit={submitOtp}
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
                className="p-7 space-y-5">

                <div>
                  <button type="button" onClick={() => { setStep('code'); setError(''); setOtp(['','','','']); }}
                    className="flex items-center gap-1 text-[13px] font-semibold mb-4"
                    style={{ color: 'rgba(255,255,255,0.40)' }}>
                    <ChevronLeft size={14} /> Back
                  </button>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                      style={{ background: 'rgba(34,197,94,0.15)' }}>
                      <Sparkles size={14} className="text-green-400" />
                    </div>
                    <h2 className="text-white font-bold text-[18px]">Check your email</h2>
                  </div>
                  <p className="text-[13px]" style={{ color: 'rgba(255,255,255,0.40)' }}>
                    OTP sent to your registered email for code{' '}
                    <span className="text-white font-semibold">#{employeeCode}</span>
                  </p>
                </div>

                {/* OTP boxes */}
                <div className="flex justify-center gap-3" onPaste={handleOtpPaste}>
                  {otp.map((digit, i) => (
                    <input key={i}
                      ref={el => { otpRefs.current[i] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={e => handleOtpChange(i, e.target.value)}
                      onKeyDown={e => handleOtpKeyDown(i, e)}
                      aria-label={`OTP digit ${i + 1}`}
                      className="w-[60px] h-[60px] text-center text-2xl font-black rounded-[16px] outline-none transition-all"
                      style={{
                        background: digit ? 'rgba(255,122,0,0.20)' : 'rgba(255,255,255,0.07)',
                        border: `2px solid ${digit ? '#FF7A00' : 'rgba(255,255,255,0.14)'}`,
                        color: 'white',
                        boxShadow: digit ? '0 0 12px rgba(255,122,0,0.3)' : 'none',
                      }}
                    />
                  ))}
                </div>

                {error && (
                  <div className="rounded-[12px] px-4 py-3 text-sm font-medium text-center"
                    style={{ background: 'rgba(239,68,68,0.15)', color: '#FCA5A5', border: '1px solid rgba(239,68,68,0.25)' }}>
                    {error}
                  </div>
                )}

                <button type="submit" disabled={loading || otp.join('').length < 4}
                  className="w-full py-[14px] rounded-[14px] font-black text-white text-[15px] flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg,#FF7A00,#FF4F87)',
                           boxShadow: '0 8px 24px rgba(255,122,0,0.38)' }}>
                  {loading ? (
                    <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : (
                    <><span>Sign In</span><ArrowRight size={16} strokeWidth={2.5} /></>
                  )}
                </button>

                <div className="text-center">
                  <button type="button" onClick={resendOtp} disabled={loading}
                    className="text-[13px] font-semibold disabled:opacity-40"
                    style={{ color: 'rgba(255,255,255,0.40)' }}>
                    Didn&apos;t receive it? <span style={{ color: '#FF7A00' }}>Resend OTP</span>
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </motion.div>

        <motion.p className="text-[11px] text-center mt-8"
          style={{ color: 'rgba(255,255,255,0.18)' }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
          Octal IT Solutions LLP · Internal Event Platform
        </motion.p>
      </div>
    </main>
  );
}
