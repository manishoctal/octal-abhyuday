/**
 * Generates ABHYUDAY branded Android icon + splash PNGs for Capacitor.
 * Run: node scripts/gen-assets.mjs
 *
 * Uses only SVG primitives (rect, circle, polygon, path) — NO <text> tags.
 * libvips on Windows does not load system fonts, so text is drawn as paths.
 */
import sharp from 'sharp';
import { mkdirSync } from 'fs';
import { join } from 'path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const RES  = `${ROOT}/android/app/src/main/res`;
const PUB  = `${ROOT}/public`;

/*
 * "A" lettermark drawn as an SVG path (no font needed).
 * viewBox 0 0 100 100 — easy to scale.
 *
 * Shape: bold triangle A with crossbar
 *  - outer triangle: M50,8 L92,92 L8,92 Z
 *  - inner cutout:   M50,22 L82,88 L18,88 Z  (makes it hollow = real A)
 *  - crossbar:        rect from x=32 y=64 w=36 h=10
 */
// evenOdd fill rule: outer triangle is filled, inner triangle creates a transparent hole.
// This ensures the hollow A looks correct on ANY background — not just the navy one.
const A_PATH = `
  <path fill-rule="evenodd" d="M50,8 L92,92 L8,92 Z M50,26 L20,88 L80,88 Z" fill="#FF7A00"/>
  <rect x="32" y="62" width="36" height="11" fill="#FF7A00"/>
`;

/* ── Launcher icon (1024×1024, opaque background) ── */
const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg"
  width="1024" height="1024" viewBox="0 0 1024 1024">
  <!-- Background -->
  <rect width="1024" height="1024" fill="#0F1035"/>
  <!-- Purple glow top-right -->
  <circle cx="820" cy="200" r="400" fill="#6B4EFF" opacity="0.22"/>
  <!-- Orange glow bottom-left -->
  <circle cx="200" cy="820" r="340" fill="#FF7A00" opacity="0.18"/>
  <!-- Faint ring -->
  <circle cx="512" cy="500" r="330" fill="none"
          stroke="rgba(255,255,255,0.07)" stroke-width="2"/>
  <!-- "A" lettermark — centred 640×640 starting at (192,130) -->
  <g transform="translate(192,130) scale(6.4)">
    ${A_PATH}
  </g>
  <!-- Orange accent bar below A -->
  <rect x="262" y="740" width="500" height="6" rx="3" fill="#FF4F87" opacity="0.65"/>
  <!-- Sparkle dots -->
  <circle cx="190" cy="190" r="12" fill="#FF7A00" opacity="0.60"/>
  <circle cx="834" cy="170" r="9"  fill="#6B4EFF" opacity="0.60"/>
  <circle cx="858" cy="728" r="10" fill="#FF4F87" opacity="0.52"/>
  <circle cx="164" cy="810" r="8"  fill="#FF7A00" opacity="0.48"/>
</svg>`;

/* ── Adaptive icon FOREGROUND (108×108, transparent bg) ── */
const FOREGROUND_SVG = `<svg xmlns="http://www.w3.org/2000/svg"
  width="108" height="108" viewBox="0 0 108 108">
  <!-- 72dp safe zone centred in 108dp canvas -->
  <g transform="translate(18,14) scale(0.72)">
    ${A_PATH}
  </g>
</svg>`;

/* ── Splash screen (2732×2732, full bleed) ── */
const SPLASH_SVG = `<svg xmlns="http://www.w3.org/2000/svg"
  width="2732" height="2732" viewBox="0 0 2732 2732">
  <!-- Background -->
  <rect width="2732" height="2732" fill="#0F1035"/>
  <!-- Purple glow -->
  <circle cx="2200" cy="600"  r="1100" fill="#6B4EFF" opacity="0.18"/>
  <!-- Orange glow -->
  <circle cx="600"  cy="2200" r="960"  fill="#FF7A00" opacity="0.16"/>
  <!-- Logo circle backdrop -->
  <circle cx="1366" cy="1250" r="400"
          fill="rgba(255,255,255,0.05)"
          stroke="rgba(255,255,255,0.10)" stroke-width="2"/>
  <!-- "A" lettermark — 600×600 centred around (1066, 950) -->
  <g transform="translate(1066,950) scale(6)">
    ${A_PATH}
  </g>
  <!-- Accent line -->
  <rect x="966" y="1700" width="800" height="5" rx="2" fill="#FF4F87" opacity="0.55"/>
  <!-- ABHYUDAY — drawn as bold rects arranged as letters (fallback if font fails) -->
  <!-- Use a simple wide orange bar with white centre to indicate brand name -->
  <rect x="766" y="1740" width="1200" height="80" rx="10" fill="#FF7A00" opacity="0.15"/>
  <!-- Sparkles -->
  <circle cx="460"  cy="460"  r="18" fill="#FF7A00" opacity="0.58"/>
  <circle cx="2272" cy="400"  r="13" fill="#6B4EFF" opacity="0.58"/>
  <circle cx="2320" cy="1850" r="15" fill="#FF4F87" opacity="0.50"/>
  <circle cx="360"  cy="2020" r="11" fill="#FF7A00" opacity="0.44"/>
  <circle cx="1720" cy="2420" r="9"  fill="#6B4EFF" opacity="0.40"/>
</svg>`;

/* ── Sizes ── */
const ICON_SIZES = [
  { dir:'mipmap-mdpi',    size:48  },
  { dir:'mipmap-hdpi',    size:72  },
  { dir:'mipmap-xhdpi',   size:96  },
  { dir:'mipmap-xxhdpi',  size:144 },
  { dir:'mipmap-xxxhdpi', size:192 },
];
// Adaptive icon foreground — sized at the 108dp canvas equivalent per density.
// mipmap-anydpi-v26 must NOT contain a PNG (anydpi beats density qualifiers, so a
// 108 px PNG there would override all density-specific files on every API 26+ device).
// The adaptive icon XMLs reference @drawable/ic_launcher_foreground (vector) instead.
const FG_SIZES = [
  { dir:'mipmap-mdpi',    size:108 },
  { dir:'mipmap-hdpi',    size:162 },
  { dir:'mipmap-xhdpi',  size:216 },
  { dir:'mipmap-xxhdpi', size:324 },
  { dir:'mipmap-xxxhdpi',size:432 },
];
const SPLASH_SIZES = [
  { dir:'drawable',              w:480,  h:800  },
  { dir:'drawable-port-mdpi',    w:320,  h:480  },
  { dir:'drawable-port-hdpi',    w:480,  h:800  },
  { dir:'drawable-port-xhdpi',   w:720,  h:1280 },
  { dir:'drawable-port-xxhdpi',  w:960,  h:1600 },
  { dir:'drawable-port-xxxhdpi', w:1280, h:1920 },
  { dir:'drawable-land-mdpi',    w:480,  h:320  },
  { dir:'drawable-land-hdpi',    w:800,  h:480  },
  { dir:'drawable-land-xhdpi',   w:1280, h:720  },
  { dir:'drawable-land-xxhdpi',  w:1600, h:960  },
  { dir:'drawable-land-xxxhdpi', w:1920, h:1280 },
];

async function run() {
  const iconBuf = Buffer.from(ICON_SVG);
  const fgBuf   = Buffer.from(FOREGROUND_SVG);
  const splBuf  = Buffer.from(SPLASH_SVG);

  /* Quick sanity check — the first icon must be >5KB or SVG rendering failed */
  const testBuf = await sharp(iconBuf).resize(192, 192).png().toBuffer();
  if (testBuf.length < 5000) {
    console.error(`❌ Icon rendered too small (${testBuf.length} bytes). SVG rendering failed.`);
    process.exit(1);
  }
  console.log(`✓ SVG sanity check passed — ${testBuf.length} bytes for 192×192`);

  /* Launcher icons — flatten to RGB (no alpha) so PackageInstaller renders correctly */
  for (const { dir, size } of ICON_SIZES) {
    const dest = join(RES, dir);
    mkdirSync(dest, { recursive: true });
    const base = sharp(iconBuf).resize(size, size).flatten({ background: '#0F1035' });
    await base.clone().png().toFile(join(dest, 'ic_launcher.png'));
    await base.clone().png().toFile(join(dest, 'ic_launcher_round.png'));
    console.log(`✓ ${dir}/ic_launcher*.png  ${size}px`);
  }

  /* Adaptive foreground */
  for (const { dir, size } of FG_SIZES) {
    const dest = join(RES, dir);
    mkdirSync(dest, { recursive: true });
    await sharp(fgBuf).resize(size, size).png().toFile(join(dest, 'ic_launcher_foreground.png'));
    console.log(`✓ ${dir}/ic_launcher_foreground.png  ${size}px`);
  }

  /* Splash screens */
  for (const { dir, w, h } of SPLASH_SIZES) {
    const dest = join(RES, dir);
    mkdirSync(dest, { recursive: true });
    await sharp(splBuf).resize(w, h, { fit:'cover', position:'centre' }).png()
      .toFile(join(dest, 'splash.png'));
    console.log(`✓ ${dir}/splash.png  ${w}×${h}`);
  }

  /* PWA icons */
  const icons = join(PUB, 'icons');
  mkdirSync(icons, { recursive: true });
  await sharp(iconBuf).resize(192, 192).png().toFile(join(icons, 'icon-192.png'));
  await sharp(iconBuf).resize(512, 512).png().toFile(join(icons, 'icon-512.png'));
  console.log('✓ PWA icons (192 + 512)');

  console.log('\n✅ All assets generated!');
}

run().catch(e => { console.error(e); process.exit(1); });
