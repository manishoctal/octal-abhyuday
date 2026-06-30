'use client';

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body>
        <div
          style={{
            minHeight: '100dvh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            textAlign: 'center',
            background: 'linear-gradient(160deg,#0F1035 0%,#1E1B4B 60%,#09091a 100%)',
            fontFamily: 'system-ui,sans-serif',
          }}
        >
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'linear-gradient(135deg,#FE9234,#FF4F87)',
              marginBottom: 32,
              fontSize: 48,
            }}
          >
            🚀
          </div>

          <h1 style={{ color: '#ffffff', fontWeight: 900, fontSize: 22, margin: '0 0 8px', letterSpacing: '-0.5px' }}>
            We&apos;re upgrading for you
          </h1>
          <p style={{ color: 'rgba(148,163,184,0.8)', fontSize: 14, lineHeight: 1.6, maxWidth: 280, margin: '0 0 32px' }}>
            Our server is getting a fresh update. This usually takes just a minute — hang tight!
          </p>

          <button
            onClick={reset}
            style={{
              height: 48,
              padding: '0 32px',
              borderRadius: 16,
              border: 'none',
              cursor: 'pointer',
              color: '#fff',
              fontWeight: 700,
              fontSize: 15,
              background: 'linear-gradient(135deg,#FE9234,#FF4F87)',
              marginBottom: 12,
              width: '100%',
              maxWidth: 280,
            }}
          >
            Try again
          </button>

          <button
            onClick={() => { window.location.href = '/'; }}
            style={{
              height: 48,
              padding: '0 32px',
              borderRadius: 16,
              border: '1px solid rgba(255,255,255,0.12)',
              cursor: 'pointer',
              color: 'rgba(255,255,255,0.6)',
              fontWeight: 600,
              fontSize: 14,
              background: 'transparent',
              width: '100%',
              maxWidth: 280,
            }}
          >
            Go home
          </button>
        </div>
      </body>
    </html>
  );
}
