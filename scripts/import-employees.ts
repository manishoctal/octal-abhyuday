/* Imports the official Abhyuday employee list from data/employees.csv,
   REPLACING all existing candidates and votes: `pnpm tsx scripts/import-employees.ts`
   CSV columns: S.no, Emp Code, Name, Official Email ID, Gender, Photo */
import fs from 'fs';
import path from 'path';
import { db, createCandidate } from '../lib/db';

const PHOTO_BASE = 'https://d1f23llskj06r6.cloudfront.net/abhyuday-2026';

const csvPath = path.join(process.cwd(), 'data', 'employees.csv');
const text = fs.readFileSync(csvPath, 'utf8');
const lines = text.split(/\r?\n/).filter((l) => l.trim());

function cleanName(raw: string) {
  return raw
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

// Fresh start with the official list
db.prepare('DELETE FROM votes').run();
db.prepare('DELETE FROM candidates').run();

let imported = 0;
const seenEmails = new Set<string>();

for (const line of lines.slice(1)) {
  const [, empCode, nameRaw, emailRaw, genderRaw, photoRaw] = line.split(',').map((s) => s?.trim() ?? '');
  if (!nameRaw) continue;
  const name = cleanName(nameRaw);
  const gender = genderRaw.toLowerCase() === 'male' ? 'male' : genderRaw.toLowerCase() === 'female' ? 'female' : null;
  let email: string | null = emailRaw ? emailRaw.toLowerCase() : null;
  if (email && seenEmails.has(email)) {
    console.warn(`  ! duplicate email skipped for ${name}: ${email}`);
    email = null;
  }
  if (email) seenEmails.add(email);
  // Photos live on CloudFront, keyed by employee code: <base>/<empCode>.png
  const id = (photoRaw ? photoRaw.replace(/\.[^.]+$/, '') : empCode) || empCode;
  const imageUrl = id
    ? `${PHOTO_BASE}/${id}.png`
    : `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(name)}`;
  createCandidate(name, gender, imageUrl, email);
  imported++;
}

const counts = db
  .prepare("SELECT gender, COUNT(*) n FROM candidates GROUP BY gender")
  .all() as { gender: string | null; n: number }[];
console.log(`Imported ${imported} employees:`, counts.map((c) => `${c.gender ?? 'unset'}=${c.n}`).join(', '));
console.log('Photos are served from public/photos/<file>.png — drop the photo files there.');
db.close();
