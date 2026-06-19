import { NextResponse } from 'next/server';
import { createCandidate, upsertCandidateByEmail } from '@/lib/db';
import { requireAdmin, isErrorResponse } from '@/lib/api-helpers';
import { broadcast } from '@/lib/events';

interface RowReport {
  row: number;
  name: string;
  status: 'added' | 'updated' | 'error';
  message?: string;
}

// Minimal CSV line parser supporting quoted fields with commas
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields.map((f) => f.trim());
}

export async function POST(req: Request) {
  const session = await requireAdmin();
  if (isErrorResponse(session)) return session;

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Upload a CSV file in the "file" field' }, { status: 400 });
  }

  const text = await file.text();
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) {
    return NextResponse.json({ error: 'CSV file is empty' }, { status: 400 });
  }

  // Header row is optional — detect it
  const first = parseCsvLine(lines[0]).map((c) => c.toLowerCase());
  const hasHeader = first.includes('name') || first.includes('gender');
  const dataLines = hasHeader ? lines.slice(1) : lines;

  const report: RowReport[] = [];
  let added = 0;

  dataLines.forEach((line, idx) => {
    const rowNum = idx + (hasHeader ? 2 : 1);
    const [name, genderRaw, imageUrl, emailRaw] = parseCsvLine(line);
    const genderLower = genderRaw?.toLowerCase();
    // Gender may be left blank (candidate stays off ballots until the admin sets it)
    const gender = genderLower === 'male' || genderLower === 'female' ? genderLower : null;
    if (!name) {
      report.push({ row: rowNum, name: name ?? '', status: 'error', message: 'Missing name' });
      return;
    }
    if (genderRaw && !gender) {
      report.push({ row: rowNum, name, status: 'error', message: `Gender must be male/female or blank (got "${genderRaw}")` });
      return;
    }
    if (!imageUrl || !/^(https?:\/\/|\/).+/.test(imageUrl)) {
      report.push({ row: rowNum, name, status: 'error', message: 'Invalid image URL' });
      return;
    }
    const email = emailRaw?.toLowerCase() ?? '';
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      report.push({ row: rowNum, name, status: 'error', message: 'Invalid email' });
      return;
    }
    if (email) {
      // Email is the dedupe key: existing candidate gets updated, not duplicated
      const { action } = upsertCandidateByEmail(name, gender, imageUrl, email);
      if (action === 'added') added++;
      report.push({ row: rowNum, name, status: action });
    } else {
      createCandidate(name, gender, imageUrl);
      added++;
      report.push({ row: rowNum, name, status: 'added' });
    }
  });

  if (added > 0) broadcast('candidates');
  return NextResponse.json({ ok: true, added, total: dataLines.length, report });
}
