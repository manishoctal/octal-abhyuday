/* Seed: tops the candidate pool up to 100 (balanced male/female) and adds a
   demo Q&A session. Idempotent — safe to run repeatedly: `pnpm seed` */
import { db, createCandidate, getCandidateByEmail, listCandidates } from '../lib/db';
import { createQaSession, createQuestion, listSessions } from '../lib/qa';

const TARGET_TOTAL = 100;

const maleFirst = ['Rahul', 'Amit', 'Vikas', 'Deepak', 'Rohit', 'Arjun', 'Karan', 'Suresh', 'Nikhil', 'Manoj', 'Ajay', 'Harsh', 'Tarun', 'Yash', 'Sandeep', 'Pankaj', 'Gaurav', 'Vivek', 'Anil', 'Rajesh', 'Mohit', 'Sumit', 'Ankit', 'Varun', 'Sachin'];
const femaleFirst = ['Priya', 'Anjali', 'Sneha', 'Kavita', 'Neha', 'Pooja', 'Ritu', 'Swati', 'Divya', 'Megha', 'Nisha', 'Payal', 'Shreya', 'Tanvi', 'Aarti', 'Bhavna', 'Chhavi', 'Deepika', 'Ekta', 'Garima', 'Isha', 'Juhi', 'Kirti', 'Lata', 'Meera'];
const lastNames = ['Sharma', 'Verma', 'Singh', 'Joshi', 'Kumar', 'Patel', 'Mehra', 'Yadav', 'Jain', 'Tiwari', 'Saxena', 'Vora', 'Bhatt', 'Dubey', 'Gupta', 'Rao', 'Nair', 'Mehta', 'Agarwal', 'Chauhan'];

const all = () => listCandidates(undefined, { round: 1, includeUngendered: true });

function* nameStream(firsts: string[]): Generator<string> {
  for (const last of lastNames) {
    for (const first of firsts) yield `${first} ${last}`;
  }
}

let added = 0;
const existingNames = new Set(all().map((c) => c.name));
const streams: ['male' | 'female', Generator<string>][] = [
  ['male', nameStream(maleFirst)],
  ['female', nameStream(femaleFirst)],
];

outer: while (all().length < TARGET_TOTAL) {
  for (const [gender, stream] of streams) {
    if (all().length >= TARGET_TOTAL) break outer;
    let name: string;
    let email: string;
    do {
      const next = stream.next();
      if (next.done) break outer;
      name = next.value;
      email = name.toLowerCase().replace(/\s+/g, '.') + '@octalsoftware.com';
    } while (existingNames.has(name) || getCandidateByEmail(email));
    const style = gender === 'male' ? 'adventurer' : 'lorelei';
    createCandidate(
      name,
      gender,
      `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(name)}&backgroundColor=b6e3f4,c0aede,ffd5dc`,
      email
    );
    existingNames.add(name);
    added++;
  }
}

const final = all();
console.log(
  `Added ${added} candidates → ${final.length} total (${final.filter((c) => c.gender === 'male').length} male / ${final.filter((c) => c.gender === 'female').length} female / ${final.filter((c) => !c.gender).length} unset).`
);

const demoTitle = 'ABHYUDAY Fun Round (demo)';
if (!listSessions().some((s) => s.title === demoTitle)) {
  const session = createQaSession(demoTitle);
  createQuestion(
    session.id,
    'mcq',
    'Which year was Octal IT Solution LLP founded?',
    ['2005', '2007', '2010', '2012'],
    1
  );
  createQuestion(session.id, 'text', 'Describe your manager in exactly three words 😄', [], null);
  createQuestion(session.id, 'rating', 'How awesome is ABHYUDAY so far?', [], null);
  console.log(`Seeded demo Q&A session "${demoTitle}" with 3 questions.`);
}

db.close();
