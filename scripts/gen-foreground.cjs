const sharp = require('sharp');
const path = require('path');

const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>
    <linearGradient id="a" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FF7A00"/>
      <stop offset="50%" stop-color="#FF4F87"/>
      <stop offset="100%" stop-color="#6B4EFF"/>
    </linearGradient>
  </defs>
  <text x="512" y="780" font-family="Arial Black,Arial,sans-serif" font-size="900" font-weight="900" text-anchor="middle" fill="url(#a)">A</text>
</svg>`);

const sizes = [
  ['mipmap-mdpi',    48 ],
  ['mipmap-hdpi',    72 ],
  ['mipmap-xhdpi',   96 ],
  ['mipmap-xxhdpi',  144],
  ['mipmap-xxxhdpi', 192],
  ['mipmap-anydpi-v26', 108],
];

const res = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res');

Promise.all(
  sizes.map(([dir, size]) =>
    sharp(svg).resize(size, size).png()
      .toFile(path.join(res, dir, 'ic_launcher_foreground.png'))
      .then(() => console.log(`✓ ${dir}/ic_launcher_foreground.png`))
  )
).then(() => console.log('All foreground icons done!')).catch(e => { console.error(e); process.exit(1); });
