/**
 * Generates ABHYUDAY branded Android icon + splash PNGs for Capacitor.
 * Run: node scripts/gen-assets.mjs
 *
 * Uses simple, flat SVGs that sharp can reliably render (no CSS gradients,
 * no linearGradient on text — just solid fills and shapes).
 */
import sharp from 'sharp';
import { mkdirSync } from 'fs';
import { join } from 'path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const RES  = `${ROOT}/android/app/src/main/res`;
const PUB  = `${ROOT}/public`;

/* ── Launcher icon (full, with background) ── */
const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <!-- Dark navy background -->
  <rect width="1024" height="1024" fill="#0F1035"/>
  <!-- Purple glow top-right -->
  <circle cx="820" cy="200" r="380" fill="#6B4EFF" opacity="0.20"/>
  <!-- Orange glow bottom-left -->
  <circle cx="220" cy="820" r="320" fill="#FF7A00" opacity="0.18"/>
  <!-- White circle ring -->
  <circle cx="512" cy="488" r="310" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="2"/>
  <!-- Big "A" — orange fill -->
  <text x="512" y="690"
        font-family="Arial Black,Arial,sans-serif"
        font-size="620" font-weight="900"
        text-anchor="middle"
        fill="#FF7A00">A</text>
  <!-- Thin accent line under the A -->
  <rect x="262" y="728" width="500" height="5" rx="3" fill="#FF4F87" opacity="0.7"/>
  <!-- ABHYUDAY wordmark -->
  <text x="512" y="900"
        font-family="Arial,sans-serif"
        font-size="78" font-weight="700"
        letter-spacing="18"
        text-anchor="middle"
        fill="rgba(255,255,255,0.70)">ABHYUDAY</text>
  <!-- Corner sparkles -->
  <circle cx="190" cy="190" r="11" fill="#FF7A00" opacity="0.65"/>
  <circle cx="834" cy="170" r="8"  fill="#6B4EFF" opacity="0.65"/>
  <circle cx="856" cy="730" r="9"  fill="#FF4F87" opacity="0.55"/>
  <circle cx="166" cy="808" r="7"  fill="#FF7A00" opacity="0.50"/>
</svg>`;

/* ── Adaptive icon FOREGROUND — transparent bg, just the "A" ── */
const FOREGROUND_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108">
  <!-- Safe zone is 72dp centred; draw inside it -->
  <!-- "A" centred in the 108dp canvas -->
  <text x="54" y="78"
        font-family="Arial Black,Arial,sans-serif"
        font-size="68" font-weight="900"
        text-anchor="middle"
        fill="#FF7A00">A</text>
</svg>`;

/* ── Splash screen (full bleed) ── */
const SPLASH_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2732 2732">
  <!-- Dark background -->
  <rect width="2732" height="2732" fill="#0F1035"/>
  <!-- Glows -->
  <circle cx="2200" cy="600"  r="1000" fill="#6B4EFF" opacity="0.16"/>
  <circle cx="600"  cy="2200" r="900"  fill="#FF7A00" opacity="0.14"/>
  <!-- Logo circle -->
  <circle cx="1366" cy="1150" r="360" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.10)" stroke-width="2"/>
  <!-- Big A -->
  <text x="1366" y="1360"
        font-family="Arial Black,Arial,sans-serif"
        font-size="500" font-weight="900"
        text-anchor="middle"
        fill="#FF7A00">A</text>
  <!-- ABHYUDAY -->
  <text x="1366" y="1680"
        font-family="Arial,sans-serif"
        font-size="190" font-weight="900"
        letter-spacing="30"
        text-anchor="middle"
        fill="#FFFFFF">ABHYUDAY</text>
  <!-- Year -->
  <text x="1366" y="1820"
        font-family="Arial,sans-serif"
        font-size="80" font-weight="400"
        letter-spacing="22"
        text-anchor="middle"
        fill="rgba(255,255,255,0.38)">2026</text>
  <!-- Tagline -->
  <text x="1366" y="1940"
        font-family="Arial,sans-serif"
        font-size="64" font-weight="500"
        letter-spacing="10"
        text-anchor="middle"
        fill="rgba(255,255,255,0.24)">CELEBRATE · COMPETE · CONNECT</text>
  <!-- Accent line -->
  <rect x="966" y="1730" width="800" height="4" rx="2" fill="#FF4F87" opacity="0.5"/>
  <!-- Footer brand -->
  <text x="1366" y="2590"
        font-family="Arial,sans-serif"
        font-size="52" font-weight="400"
        letter-spacing="8"
        text-anchor="middle"
        fill="rgba(255,255,255,0.18)">BY OCTAL IT SOLUTIONS</text>
  <!-- Sparkles -->
  <circle cx="460"  cy="460"  r="16" fill="#FF7A00" opacity="0.60"/>
  <circle cx="2272" cy="400"  r="11" fill="#6B4EFF" opacity="0.60"/>
  <circle cx="2320" cy="1850" r="14" fill="#FF4F87" opacity="0.52"/>
  <circle cx="360"  cy="2020" r="10" fill="#FF7A00" opacity="0.46"/>
  <circle cx="1720" cy="2420" r="8"  fill="#6B4EFF" opacity="0.42"/>
</svg>`;

/* ── Sizes ── */
const ICON_SIZES = [
  { dir:'mipmap-mdpi',    size:48  },
  { dir:'mipmap-hdpi',    size:72  },
  { dir:'mipmap-xhdpi',   size:96  },
  { dir:'mipmap-xxhdpi',  size:144 },
  { dir:'mipmap-xxxhdpi', size:192 },
];
const FG_SIZES = [
  { dir:'mipmap-mdpi',       size:48  },
  { dir:'mipmap-hdpi',       size:72  },
  { dir:'mipmap-xhdpi',      size:96  },
  { dir:'mipmap-xxhdpi',     size:144 },
  { dir:'mipmap-xxxhdpi',    size:192 },
  { dir:'mipmap-anydpi-v26', size:108 },
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

  /* Launcher icons (with background) */
  for (const { dir, size } of ICON_SIZES) {
    const dest = join(RES, dir);
    mkdirSync(dest, { recursive: true });
    await sharp(iconBuf).resize(size, size).png().toFile(join(dest, 'ic_launcher.png'));
    await sharp(iconBuf).resize(size, size).png().toFile(join(dest, 'ic_launcher_round.png'));
    console.log(`✓ ${dir}/ic_launcher*.png  ${size}px`);
  }

  /* Adaptive foreground (transparent bg + "A") */
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

  console.log('\n✅ All assets generated successfully!');
}

run().catch(e => { console.error(e); process.exit(1); });
