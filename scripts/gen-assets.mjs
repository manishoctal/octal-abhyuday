/**
 * Generates ABHYUDAY branded Android icon + splash PNGs for Capacitor.
 * Run: node scripts/gen-assets.mjs
 */
import sharp from 'sharp';
import { mkdirSync } from 'fs';
import { join } from 'path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');

/* ── Build source icon (1024×1024) ── */
async function makeIconSvg() {
  // Deep navy/indigo bg + orange "A" lettermark + ABHYUDAY text
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0F1035"/>
      <stop offset="50%" stop-color="#1E1B4B"/>
      <stop offset="100%" stop-color="#080D2A"/>
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FF7A00"/>
      <stop offset="50%" stop-color="#FF4F87"/>
      <stop offset="100%" stop-color="#6B4EFF"/>
    </linearGradient>
    <radialGradient id="glow1" cx="70%" cy="25%" r="50%">
      <stop offset="0%" stop-color="#6B4EFF" stop-opacity="0.4"/>
      <stop offset="100%" stop-color="#6B4EFF" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow2" cx="30%" cy="80%" r="45%">
      <stop offset="0%" stop-color="#FF7A00" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="#FF7A00" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <!-- Background -->
  <rect width="1024" height="1024" rx="220" fill="url(#bg)"/>

  <!-- Glows -->
  <rect width="1024" height="1024" rx="220" fill="url(#glow1)"/>
  <rect width="1024" height="1024" rx="220" fill="url(#glow2)"/>

  <!-- Subtle grid lines -->
  <line x1="0" y1="512" x2="1024" y2="512" stroke="rgba(255,255,255,0.04)" stroke-width="1"/>
  <line x1="512" y1="0" x2="512" y2="1024" stroke="rgba(255,255,255,0.04)" stroke-width="1"/>

  <!-- Big lettermark "A" -->
  <text x="512" y="600"
    font-family="Arial Black, Arial, sans-serif"
    font-size="540" font-weight="900"
    text-anchor="middle"
    fill="url(#accent)"
    opacity="0.92">A</text>

  <!-- ABHYUDAY wordmark at bottom -->
  <text x="512" y="920"
    font-family="Arial, sans-serif"
    font-size="82" font-weight="700" letter-spacing="22"
    text-anchor="middle"
    fill="rgba(255,255,255,0.75)">ABHYUDAY</text>

  <!-- Sparkle dots -->
  <circle cx="200" cy="200" r="10" fill="#FF7A00" opacity="0.7"/>
  <circle cx="824" cy="180" r="7"  fill="#6B4EFF" opacity="0.7"/>
  <circle cx="860" cy="720" r="9"  fill="#FF4F87" opacity="0.6"/>
  <circle cx="160" cy="800" r="6"  fill="#FF7A00" opacity="0.5"/>
</svg>`;
}

async function makeSplashSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2732 2732" width="2732" height="2732">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#050314"/>
      <stop offset="40%" stop-color="#0F1035"/>
      <stop offset="100%" stop-color="#080D2A"/>
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FF7A00"/>
      <stop offset="50%" stop-color="#FF4F87"/>
      <stop offset="100%" stop-color="#6B4EFF"/>
    </linearGradient>
    <radialGradient id="glow1" cx="65%" cy="20%" r="55%">
      <stop offset="0%" stop-color="#6B4EFF" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#6B4EFF" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow2" cx="30%" cy="85%" r="45%">
      <stop offset="0%" stop-color="#FF7A00" stop-opacity="0.28"/>
      <stop offset="100%" stop-color="#FF7A00" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <!-- Background -->
  <rect width="2732" height="2732" fill="url(#bg)"/>
  <rect width="2732" height="2732" fill="url(#glow1)"/>
  <rect width="2732" height="2732" fill="url(#glow2)"/>

  <!-- Icon circle container -->
  <circle cx="1366" cy="1200" r="340" fill="rgba(255,255,255,0.07)" stroke="rgba(255,255,255,0.12)" stroke-width="2"/>

  <!-- "A" lettermark in circle -->
  <text x="1366" y="1380"
    font-family="Arial Black, Arial, sans-serif"
    font-size="480" font-weight="900"
    text-anchor="middle"
    fill="url(#accent)"
    opacity="0.95">A</text>

  <!-- Event name -->
  <text x="1366" y="1700"
    font-family="Arial, sans-serif"
    font-size="200" font-weight="900" letter-spacing="28"
    text-anchor="middle"
    fill="white">ABHYUDAY</text>

  <!-- Subtitle -->
  <text x="1366" y="1830"
    font-family="Arial, sans-serif"
    font-size="72" font-weight="400" letter-spacing="16"
    text-anchor="middle"
    fill="rgba(255,255,255,0.45)">2026</text>

  <!-- Tagline -->
  <text x="1366" y="1940"
    font-family="Arial, sans-serif"
    font-size="66" font-weight="600" letter-spacing="10"
    text-anchor="middle"
    fill="rgba(255,255,255,0.28)">CELEBRATE · COMPETE · CONNECT</text>

  <!-- Brand footer -->
  <text x="1366" y="2580"
    font-family="Arial, sans-serif"
    font-size="55" font-weight="400" letter-spacing="8"
    text-anchor="middle"
    fill="rgba(255,255,255,0.20)">BY OCTAL IT SOLUTIONS</text>

  <!-- Sparkle dots -->
  <circle cx="500"  cy="500"  r="18" fill="#FF7A00" opacity="0.65"/>
  <circle cx="2232" cy="420"  r="12" fill="#6B4EFF" opacity="0.65"/>
  <circle cx="2300" cy="1800" r="15" fill="#FF4F87" opacity="0.55"/>
  <circle cx="380"  cy="2000" r="10" fill="#FF7A00" opacity="0.5"/>
  <circle cx="1700" cy="2400" r="8"  fill="#6B4EFF" opacity="0.45"/>
</svg>`;
}

/* ── Mipmap sizes for Android ── */
const ICON_SIZES = [
  { dir: 'mipmap-mdpi',    size: 48  },
  { dir: 'mipmap-hdpi',    size: 72  },
  { dir: 'mipmap-xhdpi',   size: 96  },
  { dir: 'mipmap-xxhdpi',  size: 144 },
  { dir: 'mipmap-xxxhdpi', size: 192 },
];

const SPLASH_SIZES = [
  { dir: 'drawable-port-mdpi',    w: 320,  h: 480  },
  { dir: 'drawable-port-hdpi',    w: 480,  h: 800  },
  { dir: 'drawable-port-xhdpi',   w: 720,  h: 1280 },
  { dir: 'drawable-port-xxhdpi',  w: 960,  h: 1600 },
  { dir: 'drawable-port-xxxhdpi', w: 1280, h: 1920 },
  { dir: 'drawable-land-mdpi',    w: 480,  h: 320  },
  { dir: 'drawable-land-hdpi',    w: 800,  h: 480  },
  { dir: 'drawable-land-xhdpi',   w: 1280, h: 720  },
  { dir: 'drawable-land-xxhdpi',  w: 1600, h: 960  },
  { dir: 'drawable-land-xxxhdpi', w: 1920, h: 1280 },
  { dir: 'drawable',              w: 480,  h: 800  },
];

const RES = `${ROOT}/android/app/src/main/res`;
const PUB = `${ROOT}/public`;

async function run() {
  const iconSvg   = Buffer.from(await makeIconSvg());
  const splashSvg = Buffer.from(await makeSplashSvg());

  /* ── Icons ── */
  for (const { dir, size } of ICON_SIZES) {
    const dest = join(RES, dir);
    mkdirSync(dest, { recursive: true });
    await sharp(iconSvg).resize(size, size).png().toFile(join(dest, 'ic_launcher.png'));
    await sharp(iconSvg).resize(size, size).png().toFile(join(dest, 'ic_launcher_round.png'));
    console.log(`✓ ${dir}/${size}x${size}`);
  }

  /* Adaptive icon foreground (v26) */
  const v26 = join(RES, 'mipmap-anydpi-v26');
  mkdirSync(v26, { recursive: true });
  await sharp(iconSvg).resize(108, 108).png().toFile(join(v26, 'ic_launcher_foreground.png'));

  /* ── Splash screens ── */
  for (const { dir, w, h } of SPLASH_SIZES) {
    const dest = join(RES, dir);
    mkdirSync(dest, { recursive: true });
    await sharp(splashSvg).resize(w, h, { fit: 'cover', position: 'centre' }).png().toFile(join(dest, 'splash.png'));
    console.log(`✓ ${dir}/${w}x${h}`);
  }

  /* ── PWA icons ── */
  const icons = join(PUB, 'icons');
  mkdirSync(icons, { recursive: true });
  await sharp(iconSvg).resize(192, 192).png().toFile(join(icons, 'icon-192.png'));
  await sharp(iconSvg).resize(512, 512).png().toFile(join(icons, 'icon-512.png'));
  console.log('✓ PWA icons (192 + 512)');

  console.log('\n✅ All assets generated!');
}

run().catch(e => { console.error(e); process.exit(1); });
