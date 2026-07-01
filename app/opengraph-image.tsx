import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'ABHYUDAY 2026 — Octal IT Solution LLP';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OgImage() {
  const eventName = 'ABHYUDAY 2026';

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(150deg,#050314 0%,#0F1035 35%,#1E1B4B 70%,#080D2A 100%)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Decorative glow blobs */}
        <div style={{
          position: 'absolute', top: -100, left: -100,
          width: 500, height: 500, borderRadius: '50%',
          background: 'radial-gradient(circle,rgba(255,122,0,0.18) 0%,transparent 70%)',
          display: 'flex',
        }} />
        <div style={{
          position: 'absolute', bottom: -120, right: -80,
          width: 480, height: 480, borderRadius: '50%',
          background: 'radial-gradient(circle,rgba(107,78,255,0.20) 0%,transparent 70%)',
          display: 'flex',
        }} />

        {/* Logo circle */}
        <div style={{
          width: 100, height: 100, borderRadius: 28,
          background: 'linear-gradient(135deg,#FE9234 0%,#FF6B35 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 60px rgba(254,146,52,0.45)',
          marginBottom: 32,
          overflow: 'hidden',
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://abhyuday.octallabs.com/icons/icon-192.png"
            width={100}
            height={100}
            alt=""
            style={{ borderRadius: 28 }}
          />
        </div>

        {/* Event name */}
        <div style={{
          fontSize: 72, fontWeight: 900,
          color: 'white',
          letterSpacing: '-2px',
          lineHeight: 1,
          marginBottom: 16,
          display: 'flex',
        }}>
          {eventName}
        </div>

        {/* Tagline */}
        <div style={{
          fontSize: 26, fontWeight: 500,
          color: 'rgba(255,255,255,0.55)',
          letterSpacing: '0.04em',
          marginBottom: 40,
          display: 'flex',
        }}>
          Octal IT Solution LLP · Foundation Day 2026
        </div>

        {/* Pill tags */}
        <div style={{ display: 'flex', gap: 12 }}>
          {['Schedule', 'Voting', 'Q&A', 'Gallery', 'Leaderboard'].map(tag => (
            <div key={tag} style={{
              padding: '10px 22px', borderRadius: 100,
              background: 'rgba(255,255,255,0.09)',
              border: '1px solid rgba(255,255,255,0.14)',
              color: 'rgba(255,255,255,0.70)',
              fontSize: 18, fontWeight: 600,
              display: 'flex',
            }}>
              {tag}
            </div>
          ))}
        </div>

        {/* Bottom domain */}
        <div style={{
          position: 'absolute', bottom: 36,
          fontSize: 20, color: 'rgba(255,255,255,0.30)',
          letterSpacing: '0.06em',
          display: 'flex',
        }}>
          abhyuday.octallabs.com
        </div>
      </div>
    ),
    { ...size }
  );
}
