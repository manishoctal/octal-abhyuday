'use client';

import { useEffect } from 'react';

/** Hides the #web-splash overlay after the page mounts (React has hydrated). */
export default function SplashHider() {
  useEffect(() => {
    const el = document.getElementById('web-splash');
    if (!el) return;
    const timer = setTimeout(() => {
      el.classList.add('hiding');
      setTimeout(() => { el.style.display = 'none'; }, 520);
    }, 250);
    return () => clearTimeout(timer);
  }, []);
  return null;
}
