'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence } from 'framer-motion';

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  done: boolean;
}

function calcTime(target: Date): TimeLeft {
  const diff = target.getTime() - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, done: true };
  return {
    days:    Math.floor(diff / 86_400_000),
    hours:   Math.floor((diff % 86_400_000) / 3_600_000),
    minutes: Math.floor((diff % 3_600_000) / 60_000),
    seconds: Math.floor((diff % 60_000) / 1_000),
    done: false,
  };
}

const SPARKLE_POS = [
  { top: '4%',  left: '6%',  delay: '0s'   },
  { top: '9%',  left: '88%', delay: '0.4s' },
  { top: '28%', left: '2%',  delay: '0.9s' },
  { top: '48%', left: '95%', delay: '0.2s' },
  { top: '68%', left: '5%',  delay: '1.1s' },
  { top: '82%', left: '91%', delay: '0.6s' },
  { top: '16%', left: '50%', delay: '1.4s' },
  { top: '91%', left: '38%', delay: '0.8s' },
  { top: '55%', left: '75%', delay: '1.7s' },
  { top: '35%', left: '22%', delay: '0.3s' },
];

const PARTY_COLORS = ['#FE9234', '#FFD700', '#FF6B6B', '#4ECDC4', '#A78BFA', '#F9FAFB'];

export default function LaunchStageClient({
  eventName,
  eventDate,
}: {
  eventName: string;
  eventDate: string;
}) {
  const target = new Date(eventDate);
  const [time, setTime]           = useState<TimeLeft>(() => calcTime(target));
  const [celebrating, setCelebrate] = useState(false);
  const firedRef = useRef(false);

  const fireworks = useCallback(() => {
    const burst = (x: number, y: number, angle: number, count = 100) =>
      confetti({ particleCount: count, spread: 72, angle, origin: { x, y }, colors: PARTY_COLORS, zIndex: 200 });

    burst(0.5, 0.65, 90, 160);
    setTimeout(() => { burst(0.12, 0.78, 58); burst(0.88, 0.78, 122); }, 320);
    setTimeout(() => { burst(0.3,  0.55, 75); burst(0.7,  0.55, 105); }, 680);
    setTimeout(() => { burst(0.5,  0.45, 90, 220); },                    1100);
    setTimeout(() => { burst(0.2,  0.4,  65); burst(0.8,  0.4,  115); }, 1600);

    let f = 0;
    const rain = setInterval(() => {
      if (f++ > 30) { clearInterval(rain); return; }
      confetti({
        particleCount: 14,
        angle: 55 + Math.random() * 70,
        spread: 52,
        origin: { x: Math.random(), y: 0 },
        colors: PARTY_COLORS,
        gravity: 0.85,
        zIndex: 200,
      });
    }, 110);
  }, []);

  const celebrate = useCallback(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    setCelebrate(true);
    fireworks();
  }, [fireworks]);

  useEffect(() => {
    const tick = () => {
      const t = calcTime(target);
      setTime(t);
      if (t.done) celebrate();
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [celebrate, target]);

  return (
    <div
      className="min-h-dvh relative overflow-hidden text-white select-none"
      style={{
        background: celebrating
          ? 'linear-gradient(160deg,#1a0533 0%,#7c2d12 50%,#1a0533 100%)'
          : 'linear-gradient(160deg,#020617 0%,#1e1b4b 50%,#020617 100%)',
        transition: 'background 2s ease',
      }}
    >
      {/* Ambient glow orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute w-[600px] h-[600px] rounded-full opacity-20 blur-3xl"
          style={{ background: '#4338ca', top: '-10%', left: '-10%' }}
        />
        <div
          className="absolute w-[500px] h-[500px] rounded-full opacity-15 blur-3xl"
          style={{ background: '#7c3aed', bottom: '-5%', right: '-10%' }}
        />
      </div>

      {/* Sparkles */}
      {SPARKLE_POS.map((s, i) => (
        <span
          key={i}
          className="sparkle"
          style={{ top: s.top, left: s.left, animationDelay: s.delay }}
        />
      ))}

      {/* White flash on launch */}
      {celebrating && <LaunchFlash />}

      <div className="relative z-10 flex flex-col items-center justify-center min-h-dvh px-6 py-12 text-center">
        {/* Branding */}
        <motion.div
          initial={{ opacity: 0, y: -24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
          className="mb-10"
        >
          <p className="text-xs sm:text-sm font-bold uppercase tracking-[0.35em] text-amber-300/60 mb-4">
            Octal IT Solution LLP presents
          </p>
          <h1 className="text-5xl sm:text-8xl font-black leading-none gold-text">{eventName}</h1>
        </motion.div>

        <AnimatePresence mode="wait">
          {celebrating ? (
            <CelebrationView key="celebrate" eventName={eventName} />
          ) : (
            <CountdownView key="countdown" time={time} eventDate={eventDate} />
          )}
        </AnimatePresence>

        {/* Buttons */}
        <div className="mt-14 flex flex-col items-center gap-3">
          {!celebrating && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2 }}
              onClick={() => { firedRef.current = false; celebrate(); }}
              className="px-6 py-2.5 rounded-full text-xs font-semibold border border-white/15 text-white/35 hover:text-white/70 hover:border-white/35 transition-all duration-200"
            >
              ✨ Test Celebration
            </motion.button>
          )}
          {celebrating && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 4 }}
              onClick={() => { setCelebrate(false); firedRef.current = false; }}
              className="px-6 py-2.5 rounded-full text-xs font-semibold border border-white/15 text-white/40 hover:text-white/70 hover:border-white/35 transition-all duration-200"
            >
              ↩ Back to countdown
            </motion.button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Countdown View ────────────────────────────────────────────────── */

function CountdownView({ time, eventDate }: { time: TimeLeft; eventDate: string }) {
  const d = new Date(eventDate);
  const formatted = d.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col items-center"
    >
      <p className="text-sm sm:text-base font-semibold text-slate-400 mb-10 tracking-wide">
        {formatted}
      </p>

      <div className="flex items-end justify-center gap-2 sm:gap-5">
        <FlipUnit value={time.days}    label="Days"    />
        <Colon />
        <FlipUnit value={time.hours}   label="Hours"   />
        <Colon />
        <FlipUnit value={time.minutes} label="Minutes" />
        <Colon />
        <FlipUnit value={time.seconds} label="Seconds" accent />
      </div>

      {time.days === 0 && time.hours === 0 && time.minutes < 10 && (
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: [0, 1, 0.7, 1] }}
          transition={{ duration: 1.2, repeat: Infinity }}
          className="mt-10 text-lg font-bold text-amber-400"
        >
          Almost time! Get ready 🚀
        </motion.p>
      )}
    </motion.div>
  );
}

function FlipUnit({
  value,
  label,
  accent = false,
}: {
  value: number;
  label: string;
  accent?: boolean;
}) {
  const str = String(value).padStart(2, '0');

  return (
    <div className="flex flex-col items-center gap-2.5">
      <div
        className={`relative w-[72px] h-[88px] sm:w-28 sm:h-36 rounded-2xl sm:rounded-3xl overflow-hidden flex items-center justify-center ${
          accent
            ? 'border border-amber-400/50 shadow-[0_0_30px_rgba(251,191,36,0.2)]'
            : 'border border-white/10'
        }`}
        style={{
          background: accent
            ? 'linear-gradient(180deg,rgba(254,146,52,0.18) 0%,rgba(120,53,15,0.25) 100%)'
            : 'rgba(255,255,255,0.04)',
        }}
      >
        {/* top shine */}
        <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/8 to-transparent pointer-events-none" />
        {/* mid divider */}
        <div className="absolute inset-x-0 top-1/2 h-px bg-black/50 pointer-events-none" />

        <AnimatePresence mode="popLayout">
          <motion.span
            key={str}
            initial={{ y: '-110%', opacity: 0 }}
            animate={{ y: '0%',    opacity: 1 }}
            exit={{    y: '110%',  opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className={`text-4xl sm:text-6xl font-black tabular-nums ${
              accent ? 'text-amber-300' : 'text-white'
            }`}
          >
            {str}
          </motion.span>
        </AnimatePresence>
      </div>
      <span className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
        {label}
      </span>
    </div>
  );
}

function Colon() {
  return (
    <motion.div
      animate={{ opacity: [1, 0.15, 1] }}
      transition={{ repeat: Infinity, duration: 1, ease: 'easeInOut' }}
      className="pb-8 text-2xl sm:text-4xl font-black text-slate-600 select-none"
    >
      :
    </motion.div>
  );
}

/* ── Celebration View ──────────────────────────────────────────────── */

function CelebrationView({ eventName }: { eventName: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.4 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ type: 'spring', stiffness: 180, damping: 18 }}
      className="flex flex-col items-center gap-6 sm:gap-8"
    >
      {/* Emoji burst row */}
      <div className="flex gap-3 sm:gap-5 text-5xl sm:text-7xl">
        {['🎉', '🎊', '✨', '🎊', '🎉'].map((e, i) => (
          <motion.span
            key={i}
            initial={{ scale: 0, rotate: -40 + i * 10 }}
            animate={{ scale: [0, 1.4, 1], rotate: [0, 20, -12, 0] }}
            transition={{ delay: i * 0.09, type: 'spring', stiffness: 350, damping: 14 }}
          >
            {e}
          </motion.span>
        ))}
      </div>

      {/* Main message */}
      <motion.div
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0,  opacity: 1 }}
        transition={{ delay: 0.25, duration: 0.7, ease: 'easeOut' }}
        className="space-y-3"
      >
        <p className="text-base sm:text-xl font-bold uppercase tracking-[0.3em] text-amber-300/80">
          It&apos;s time!
        </p>
        <h2 className="text-5xl sm:text-8xl font-black gold-text leading-none">{eventName}</h2>
        <p className="text-xl sm:text-3xl font-bold text-white/80">is officially here! 🚀</p>
      </motion.div>

      {/* Pulsing badge */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7, duration: 0.5 }}
      >
        <motion.div
          animate={{ scale: [1, 1.07, 1], boxShadow: ['0 0 0px rgba(251,191,36,0)', '0 0 40px rgba(251,191,36,0.5)', '0 0 0px rgba(251,191,36,0)'] }}
          transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
          className="px-10 py-4 rounded-full border-2 border-amber-400/70 text-amber-300 text-xl sm:text-2xl font-black tracking-wider"
        >
          🎆 LET&apos;S GO! 🎆
        </motion.div>
      </motion.div>

      {/* Star rain effect */}
      <StarField />
    </motion.div>
  );
}

function StarField() {
  const stars = Array.from({ length: 16 }, (_, i) => ({
    x: `${(i * 6.5) % 100}%`,
    delay: `${(i * 0.18) % 2}s`,
    dur: `${1.5 + (i % 4) * 0.4}s`,
    size: i % 3 === 0 ? 'text-2xl' : 'text-lg',
  }));

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {stars.map((s, i) => (
        <motion.span
          key={i}
          className={`absolute ${s.size} select-none`}
          style={{ left: s.x, top: '-2rem' }}
          animate={{ y: ['0vh', '110vh'], opacity: [0, 1, 1, 0] }}
          transition={{
            duration: parseFloat(s.dur),
            delay: parseFloat(s.delay),
            repeat: Infinity,
            ease: 'linear',
          }}
        >
          {i % 5 === 0 ? '⭐' : i % 5 === 1 ? '✨' : i % 5 === 2 ? '🌟' : i % 5 === 3 ? '💫' : '⚡'}
        </motion.span>
      ))}
    </div>
  );
}

function LaunchFlash() {
  return (
    <>
      {/* Initial white burst */}
      <motion.div
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="fixed inset-0 bg-white pointer-events-none z-50"
      />
      {/* Warm glow lingers */}
      <motion.div
        animate={{ opacity: [0, 0.5, 0.2, 0.4, 0] }}
        transition={{ duration: 4, times: [0, 0.1, 0.3, 0.5, 1] }}
        className="fixed inset-0 pointer-events-none z-30"
        style={{
          background: 'radial-gradient(ellipse at 50% 30%, rgba(254,146,52,0.7), transparent 65%)',
        }}
      />
    </>
  );
}
