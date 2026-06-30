'use client';

import { useEffect, useState } from 'react';

type Platform = 'android' | 'ios' | null;

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function PWAInstallBanner() {
  const [platform, setPlatform]       = useState<Platform>(null);
  const [deferredPrompt, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible]         = useState(false);
  const [showIOSHelp, setShowIOSHelp] = useState(false);
  const [installing, setInstalling]   = useState(false);

  useEffect(() => {
    // Already installed as PWA → never show
    if (
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true
    ) return;

    // Already dismissed this session
    if (sessionStorage.getItem('pwa-banner-dismissed')) return;

    const ua = navigator.userAgent;
    const isIOS     = /iphone|ipad|ipod/i.test(ua) && !/crios|fxios/i.test(ua);
    const isAndroid = /android/i.test(ua);
    const isSafari  = /^((?!chrome|android).)*safari/i.test(ua);

    if (isIOS && isSafari) {
      setPlatform('ios');
      setVisible(true);
    } else if (isAndroid) {
      // Android: wait for browser's install event
      const handler = (e: Event) => {
        e.preventDefault();
        setDeferred(e as BeforeInstallPromptEvent);
        setPlatform('android');
        setVisible(true);
      };
      window.addEventListener('beforeinstallprompt', handler);
      return () => window.removeEventListener('beforeinstallprompt', handler);
    }
  }, []);

  function dismiss() {
    sessionStorage.setItem('pwa-banner-dismissed', '1');
    setVisible(false);
    setShowIOSHelp(false);
  }

  async function installAndroid() {
    if (!deferredPrompt) return;
    setInstalling(true);
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setVisible(false);
    } else {
      setInstalling(false);
    }
    setDeferred(null);
  }

  if (!visible) return null;

  return (
    <>
      {/* Backdrop for iOS help sheet */}
      {showIOSHelp && (
        <div
          className="fixed inset-0 z-[998] bg-black/50"
          onClick={() => setShowIOSHelp(false)}
        />
      )}

      {/* Main banner — pinned to bottom */}
      <div
        style={{
          position: 'fixed',
          bottom: showIOSHelp ? '0' : '72px', // above bottom nav
          left: 0,
          right: 0,
          zIndex: 999,
          padding: '0 12px 8px',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
            borderRadius: 16,
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            border: '1px solid rgba(254,146,52,0.25)',
            pointerEvents: 'all',
          }}
        >
          {/* App icon */}
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #FE9234, #f97316)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              fontSize: 22,
              fontWeight: 700,
              color: '#fff',
            }}
          >
            O
          </div>

          {/* Text */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: '#fff', fontWeight: 600, fontSize: 14, lineHeight: 1.3 }}>
              Install the App
            </div>
            <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 2, lineHeight: 1.4 }}>
              {platform === 'ios'
                ? 'Add to Home Screen for the best experience'
                : 'Get instant access & offline support'}
            </div>
          </div>

          {/* Action */}
          {platform === 'android' ? (
            <button
              onClick={installAndroid}
              disabled={installing}
              style={{
                background: 'linear-gradient(135deg, #FE9234, #f97316)',
                border: 'none',
                borderRadius: 8,
                color: '#fff',
                fontWeight: 700,
                fontSize: 13,
                padding: '8px 14px',
                cursor: installing ? 'default' : 'pointer',
                flexShrink: 0,
                opacity: installing ? 0.7 : 1,
              }}
            >
              {installing ? '…' : 'Install'}
            </button>
          ) : (
            <button
              onClick={() => setShowIOSHelp(h => !h)}
              style={{
                background: 'linear-gradient(135deg, #FE9234, #f97316)',
                border: 'none',
                borderRadius: 8,
                color: '#fff',
                fontWeight: 700,
                fontSize: 13,
                padding: '8px 14px',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              How?
            </button>
          )}

          {/* Dismiss */}
          <button
            onClick={dismiss}
            aria-label="Dismiss"
            style={{
              background: 'none',
              border: 'none',
              color: '#64748b',
              fontSize: 18,
              cursor: 'pointer',
              padding: '4px',
              flexShrink: 0,
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* iOS step-by-step sheet */}
      {showIOSHelp && (
        <div
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 1000,
            background: '#1e293b',
            borderRadius: '20px 20px 0 0',
            padding: '20px 20px 40px',
            border: '1px solid rgba(254,146,52,0.2)',
            boxShadow: '0 -8px 32px rgba(0,0,0,0.5)',
          }}
        >
          {/* Handle */}
          <div style={{ width: 40, height: 4, background: '#475569', borderRadius: 2, margin: '0 auto 20px' }} />

          <div style={{ color: '#fff', fontWeight: 700, fontSize: 16, marginBottom: 4 }}>
            Add to Home Screen
          </div>
          <div style={{ color: '#94a3b8', fontSize: 13, marginBottom: 20 }}>
            Follow these steps in Safari to install the app:
          </div>

          {[
            { icon: '⬆️', step: '1', text: 'Tap the Share button at the bottom of Safari (the box with an arrow)' },
            { icon: '📲', step: '2', text: 'Scroll down and tap "Add to Home Screen"' },
            { icon: '✅', step: '3', text: 'Tap "Add" in the top-right corner' },
          ].map(({ icon, step, text }) => (
            <div key={step} style={{ display: 'flex', gap: 14, marginBottom: 16, alignItems: 'flex-start' }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: 'rgba(254,146,52,0.15)',
                  border: '1px solid rgba(254,146,52,0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 18,
                  flexShrink: 0,
                }}
              >
                {icon}
              </div>
              <div style={{ color: '#cbd5e1', fontSize: 14, paddingTop: 8, lineHeight: 1.4 }}>
                {text}
              </div>
            </div>
          ))}

          <button
            onClick={dismiss}
            style={{
              width: '100%',
              padding: '13px',
              marginTop: 8,
              background: 'linear-gradient(135deg, #FE9234, #f97316)',
              border: 'none',
              borderRadius: 12,
              color: '#fff',
              fontWeight: 700,
              fontSize: 15,
              cursor: 'pointer',
            }}
          >
            Got it!
          </button>
        </div>
      )}
    </>
  );
}
