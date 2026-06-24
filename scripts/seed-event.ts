/**
 * seed-event.ts
 * Seeds full demo data for ABHYUDAY 2026 @ Jollywood Banquet and Resort, Pushkar.
 * Idempotent — safe to run multiple times; skips items that already exist.
 * Run: pnpm tsx scripts/seed-event.ts
 */

import Database from 'better-sqlite3';
import path from 'path';

const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), 'data');
const db = new Database(path.join(DATA_DIR, 'vote.db'));

// ─── helpers ────────────────────────────────────────────────────────────────

function exists(table: string, col: string, val: string): boolean {
  const row = db.prepare(`SELECT id FROM ${table} WHERE ${col} = ?`).get(val) as { id: number } | undefined;
  return !!row;
}

function infoExists(section: string, title: string): boolean {
  const row = db.prepare('SELECT id FROM event_info WHERE section = ? AND title = ?').get(section, title) as { id: number } | undefined;
  return !!row;
}

function insertInfo(section: string, title: string, body: string, mapsUrl: string | null = null, sortOrder = 0) {
  if (infoExists(section, title)) return;
  db.prepare('INSERT INTO event_info (section, title, body, maps_url, sort_order) VALUES (?, ?, ?, ?, ?)')
    .run(section, title, body, mapsUrl, sortOrder);
  console.log(`  ✓ event_info [${section}] "${title}"`);
}

function insertSchedule(title: string, startTime: string, endTime: string | null, type: string, location: string | null, speaker: string | null, description: string | null, sortOrder = 0) {
  const row = db.prepare('SELECT id FROM schedule_sessions WHERE title = ? AND start_time = ?').get(title, startTime) as { id: number } | undefined;
  if (row) return;
  db.prepare('INSERT INTO schedule_sessions (title, start_time, end_time, type, location, speaker, description, sort_order) VALUES (?,?,?,?,?,?,?,?)')
    .run(title, startTime, endTime, type, location, speaker, description, sortOrder);
  console.log(`  ✓ schedule [${type}] "${title}"`);
}

function insertCategory(name: string, description: string, sortOrder = 0): number | null {
  if (exists('award_categories', 'name', name)) return null;
  const r = db.prepare('INSERT INTO award_categories (name, description, sort_order) VALUES (?, ?, ?)').run(name, description, sortOrder);
  console.log(`  ✓ award_category "${name}"`);
  return Number(r.lastInsertRowid);
}

function insertNominee(categoryId: number, name: string, department: string) {
  const row = db.prepare('SELECT id FROM award_nominees WHERE category_id = ? AND name = ?').get(categoryId, name) as { id: number } | undefined;
  if (row) return;
  db.prepare('INSERT INTO award_nominees (category_id, name, department) VALUES (?, ?, ?)').run(categoryId, name, department);
  console.log(`    · nominee "${name}" (${department})`);
}

// ─── update event name & date ────────────────────────────────────────────────

db.prepare(`INSERT INTO settings (key, value) VALUES ('event_name', 'ABHYUDAY 2026')
            ON CONFLICT(key) DO UPDATE SET value = 'ABHYUDAY 2026'`).run();
db.prepare(`INSERT INTO settings (key, value) VALUES ('event_date', '2026-07-04T09:00:00')
            ON CONFLICT(key) DO UPDATE SET value = '2026-07-04T09:00:00'`).run();
console.log('✓ settings: event_name=ABHYUDAY 2026, event_date=2026-07-04');

// ─── event info ─────────────────────────────────────────────────────────────

console.log('\n── Venue & Info ──');

insertInfo('venue', 'Jollywood Banquet and Resort', [
  'An opulent resort property set amidst the golden landscape of Pushkar, Rajasthan.',
  'Near Pushkar Lake, Ajmer–Pushkar Road, Pushkar, Rajasthan 305022',
  '',
  'Check-in from 8:30 AM. Dress code: Smart Casual / Traditional.',
].join('\n'), 'https://share.google/tj84wTe0nPVPQd3Qr', 0);

insertInfo('venue', 'Resort Layout', [
  '• Grand Ballroom — Main ceremony & awards (Ground Floor)',
  '• Garden Pavilion — Morning tea, cultural performances',
  '• Rooftop Terrace — Cocktails & evening dinner',
  '• Conference Hall A — Break-out sessions & team activities',
  '• Lawn Area — Group photograph & outdoor games',
].join('\n'), null, 1);

insertInfo('parking', 'Parking at Jollywood Resort', [
  'Dedicated parking available inside the resort premises for 150+ vehicles.',
  '',
  '🚗 Enter from the main gate on Ajmer–Pushkar Road.',
  '🏍️ Two-wheeler parking: Left side of main entrance.',
  '🚌 Bus / Company transport: Drop-off point at the main porch.',
].join('\n'), 'https://share.google/tj84wTe0nPVPQd3Qr', 0);

insertInfo('parking', 'Overflow Parking', [
  'If the main lot is full, overflow parking is available at:',
  'Pushkar Municipal Parking, Near Brahma Temple — 5 min walk to resort.',
  '',
  'Shuttle service will run every 20 minutes from overflow to resort entrance.',
].join('\n'), null, 1);

insertInfo('contacts', 'Event Coordinator', [
  'Manish Prajapati (Project Manager, Octal IT Solution)',
  '📞 +91 98765 00001',
  '📧 manish.prajapati@octalsoftware.com',
].join('\n'), null, 0);

insertInfo('contacts', 'Resort Front Desk', [
  'Jollywood Banquet and Resort',
  '📞 062625 62628',
  '🕐 Available 24 hours',
].join('\n'), null, 1);

insertInfo('contacts', 'Transport & Logistics', [
  'Rajesh Kumar (Transport In-charge)',
  '📞 +91 98765 00002',
  '',
  'For bus timings, pickup schedules, or vehicle issues.',
].join('\n'), null, 2);

insertInfo('contacts', 'Medical / First Aid', [
  'First aid station: Near the main entrance lobby.',
  '',
  'On-call doctor: Dr. Priya Sharma',
  '📞 +91 98765 00003',
  '',
  'Nearest hospital: Pushkar Government Hospital (3 km)',
  'Emergency: 108',
].join('\n'), null, 3);

insertInfo('faq', 'What is the dress code?', [
  'Smart Casual or Traditional Indian wear is recommended.',
  'The evening ceremony is slightly formal — kurta/blazer for men,',
  'ethnic/semi-formal for women works perfectly.',
].join('\n'), null, 0);

insertInfo('faq', 'Is food included?', [
  'Yes! All meals are included:',
  '• Morning welcome tea & snacks (9:00 AM)',
  '• Lunch buffet (1:00 PM)',
  '• Evening high tea (4:30 PM)',
  '• Dinner (8:00 PM)',
  '',
  'Vegetarian, Jain, and gluten-free options available.',
  'Please inform the event team about dietary requirements in advance.',
].join('\n'), null, 1);

insertInfo('faq', 'Is accommodation provided?', [
  'Accommodation is provided for outstation employees who travelled more than 200 km.',
  '',
  'Check-in: 4 July 2026, from 12:00 PM',
  'Check-out: 5 July 2026, by 11:00 AM',
  '',
  'Contact the event coordinator if you need room allocation details.',
].join('\n'), null, 2);

insertInfo('faq', 'Can I bring family?', [
  'ABHYUDAY 2026 is an employee-only event.',
  'Family members are not permitted, except for the evening cultural show',
  'where immediate family (spouse/children) may join with prior registration.',
].join('\n'), null, 3);

insertInfo('faq', 'Will there be WiFi?', [
  'Yes, resort WiFi is available throughout the venue.',
  '',
  'Network: Jollywood_Event',
  'Password: Abhyuday2026',
  '',
  'For video calls or large uploads, use mobile data as the shared WiFi',
  'may be slower during peak hours.',
].join('\n'), null, 4);

insertInfo('instructions', 'Important Guidelines', [
  '1. Carry your company ID card — required at entrance check-in.',
  '2. Scan your QR badge (this app → My Badge) at the entrance.',
  '3. Photography is allowed in all areas except confidential sessions.',
  '4. Please be punctual — sessions begin on time.',
  '5. Keep your phone on silent during ceremonies and presentations.',
  '6. Respect the resort property and fellow employees.',
  '7. Alcohol will be served responsibly. Drink driving is strictly prohibited.',
  '8. Report any issues to the event coordinator immediately.',
].join('\n'), null, 0);

insertInfo('instructions', 'Transport Schedule', [
  'Company buses depart from Ahmedabad office at 6:00 AM sharp on 4 July.',
  '',
  'Pickup points:',
  '• 5:45 AM — SG Highway, near Shyamal Cross Road',
  '• 6:00 AM — Octal IT Solution, Zion Prime, Ahmedabad',
  '• 6:15 AM — Bopal Chokdi',
  '',
  'Return buses depart from Jollywood Resort at 10:30 PM.',
  'Please board your assigned bus. Late arrivals will need to arrange own transport.',
].join('\n'), null, 1);

// ─── schedule ────────────────────────────────────────────────────────────────

console.log('\n── Schedule (4 July 2026) ──');

const schedule: [string, string, string | null, string, string | null, string | null, string | null, number][] = [
  ['Welcome Tea & Registration',       '2026-07-04T08:30:00', '2026-07-04T09:15:00', 'break',     'Garden Pavilion',    null,                    'Networking, registration desk, name badges', 0],
  ['Welcome Address & Lamp Lighting',  '2026-07-04T09:15:00', '2026-07-04T09:45:00', 'ceremony',  'Grand Ballroom',     'Manish Prajapati',      'Inaugural ceremony with lamp lighting and welcome speech', 1],
  ['Leadership Vision Talk',           '2026-07-04T09:45:00', '2026-07-04T10:30:00', 'session',   'Grand Ballroom',     'CEO — Octal IT Solution','Annual company vision, highlights of 2025–26, roadmap ahead', 2],
  ['Team Achievements & Recognition',  '2026-07-04T10:30:00', '2026-07-04T11:15:00', 'ceremony',  'Grand Ballroom',     null,                    'Department milestones, project highlights, employee achievements', 3],
  ['Tea Break & Networking',           '2026-07-04T11:15:00', '2026-07-04T11:45:00', 'break',     'Garden Pavilion',    null,                    null, 4],
  ['Team Building Activity — Round 1', '2026-07-04T11:45:00', '2026-07-04T13:00:00', 'activity',  'Lawn Area',          null,                    'Fun team challenges, group games, and ice-breakers', 5],
  ['Lunch Buffet',                     '2026-07-04T13:00:00', '2026-07-04T14:15:00', 'meal',      'Rooftop Terrace',    null,                    'Traditional Rajasthani + pan-Indian buffet. Veg/Jain options available.', 6],
  ['Live Q&A — ABHYUDAY Fun Round',    '2026-07-04T14:15:00', '2026-07-04T15:00:00', 'session',   'Grand Ballroom',     'Hosted by HR Team',     'Interactive quiz, polls, and fun questions via the app', 7],
  ['Cultural Programme — Folk Dance',  '2026-07-04T15:00:00', '2026-07-04T16:00:00', 'activity',  'Garden Pavilion',    null,                    'Rajasthani folk dance and music performance by local artists', 8],
  ['High Tea Break',                   '2026-07-04T16:00:00', '2026-07-04T16:30:00', 'break',     'Garden Pavilion',    null,                    null, 9],
  ['Talent Show — Employee Acts',      '2026-07-04T16:30:00', '2026-07-04T17:30:00', 'activity',  'Grand Ballroom',     null,                    'Singing, dance, comedy skits by Octal employees', 10],
  ['Popularity Voting Results',        '2026-07-04T17:30:00', '2026-07-04T18:00:00', 'ceremony',  'Grand Ballroom',     null,                    'Most Popular Male & Female reveal with confetti', 11],
  ['Group Photograph',                 '2026-07-04T18:00:00', '2026-07-04T18:20:00', 'activity',  'Lawn Area',          null,                    'Full team group photo — please wear your event badge', 12],
  ['Freshen Up / Free Time',           '2026-07-04T18:20:00', '2026-07-04T19:30:00', 'break',     'Resort Rooms',       null,                    'Change for evening, rest, room check-in for outstation employees', 13],
  ['Cocktail Evening & DJ Night',      '2026-07-04T19:30:00', '2026-07-04T20:30:00', 'activity',  'Rooftop Terrace',    null,                    'Mocktails, cocktails, and DJ music. Dress to impress!', 14],
  ['ABHYUDAY Awards Ceremony',         '2026-07-04T20:30:00', '2026-07-04T21:45:00', 'ceremony',  'Grand Ballroom',     null,                    'Annual awards — Best Performer, Best Team, Hidden Gem & more', 15],
  ['Gala Dinner',                      '2026-07-04T21:45:00', '2026-07-04T23:00:00', 'meal',      'Rooftop Terrace',    null,                    'Dinner buffet with live ghazal music. Celebrate the year!', 16],
  ['Departure & Safe Journey',         '2026-07-04T22:30:00', null,                  'break',     'Main Porch',         null,                    'Company buses depart at 10:30 PM. Thank you for being part of ABHYUDAY 2026!', 17],
];

for (const args of schedule) insertSchedule(...args);

// ─── awards ──────────────────────────────────────────────────────────────────

console.log('\n── Awards ──');

const awardData: [string, string, [string, string][]][] = [
  ['Best Performer of the Year',       'Exceptional individual contribution to company goals',
    [['Rahul Sharma','Engineering'],['Priya Verma','Design'],['Amit Singh','Sales'],['Anjali Joshi','HR']]],
  ['Best Team of the Year',            'Team that delivered the most impact as a unit',
    [['Project Phoenix Team','Engineering'],['Growth & Marketing Squad','Marketing'],['Customer Success Team','Support']]],
  ['Rising Star',                      'Best new employee who joined in the last 12 months',
    [['Yash Patel','Engineering'],['Tanvi Mehta','Design'],['Varun Gupta','Sales'],['Shreya Rao','Finance']]],
  ['Hidden Gem',                       'The quiet achiever whose work makes everyone else shine',
    [['Deepak Bhatt','Engineering'],['Kavita Nair','Operations'],['Nikhil Jain','QA']]],
  ['Best Mentor',                      'Goes above and beyond to guide and uplift colleagues',
    [['Suresh Kumar','Engineering'],['Ritu Saxena','HR'],['Ajay Vora','Sales']]],
  ['Innovation Award',                 'Introduced an idea, tool, or process that changed how we work',
    [['Karan Dubey','Engineering'],['Swati Agarwal','Product'],['Vivek Chauhan','Engineering']]],
  ['Most Popular Male',                'Octal\'s favourite — voted by employees',
    [['Rohit Sharma','Engineering'],['Gaurav Mehta','Sales'],['Pankaj Yadav','Operations'],['Tarun Singh','Finance']]],
  ['Most Popular Female',              'Octal\'s favourite — voted by employees',
    [['Neha Gupta','Design'],['Divya Tiwari','HR'],['Megha Verma','Marketing'],['Pooja Joshi','Engineering']]],
  ['Best Dressed',                     'Style icon of ABHYUDAY 2026',
    [['Arjun Saxena','Engineering'],['Aarti Mehra','Design'],['Mohit Rao','Sales']]],
  ['Spirit of Octal',                  'Embodies Octal\'s values — integrity, innovation, and impact',
    [['Sandeep Kumar','Operations'],['Bhavna Patel','HR'],['Sumit Jain','Engineering']]],
];

for (const [name, desc, nominees] of awardData) {
  const sortOrder = awardData.indexOf([name, desc, nominees]);
  const catId = insertCategory(name, desc, sortOrder);
  if (catId) {
    for (const [nom, dept] of nominees) insertNominee(catId, nom, dept);
  }
}

// ─── update existing "Best Team Player" category name (rename to match above) ──
const oldCat = db.prepare('SELECT id FROM award_categories WHERE name = ?').get('Best Team Player') as { id: number } | undefined;
if (oldCat) {
  db.prepare('UPDATE award_categories SET name = ?, description = ? WHERE id = ?')
    .run('Best Team of the Year', 'Team that delivered the most impact as a unit', oldCat.id);
  console.log('  ✓ renamed "Best Team Player" → "Best Team of the Year"');
}

// ─── summary ─────────────────────────────────────────────────────────────────

const counts = {
  event_info:        (db.prepare('SELECT COUNT(*) as c FROM event_info').get() as { c: number }).c,
  schedule_sessions: (db.prepare('SELECT COUNT(*) as c FROM schedule_sessions').get() as { c: number }).c,
  award_categories:  (db.prepare('SELECT COUNT(*) as c FROM award_categories').get() as { c: number }).c,
  award_nominees:    (db.prepare('SELECT COUNT(*) as c FROM award_nominees').get() as { c: number }).c,
};

console.log('\n── Done ──────────────────────────────────────────────────────────');
console.log(`  event_info items:   ${counts.event_info}`);
console.log(`  schedule sessions:  ${counts.schedule_sessions}`);
console.log(`  award categories:   ${counts.award_categories}`);
console.log(`  award nominees:     ${counts.award_nominees}`);
console.log('\nRun `pnpm dev` and open the app — all sections are now populated.');

db.close();
