/* Concurrency test: simulates N employees logging in, loading candidates,
   opening a realtime SSE stream, and voting — all at once.
   Usage: node scripts/loadtest.mjs [users] [baseUrl] */
import http from 'node:http';

const USERS = Number(process.argv[2] || 100);
const BASE = process.argv[3] || 'http://localhost:3000';
const DOMAIN = 'octalsoftware.com';

function req(method, path, { cookie, body } = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const u = new URL(BASE + path);
    const r = http.request(
      { hostname: u.hostname, port: u.port, path: u.pathname + u.search, method,
        headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}),
          ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}) } },
      (res) => {
        let buf = '';
        res.on('data', (c) => (buf += c));
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: buf }));
      }
    );
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

const pct = (arr, p) => arr.length ? arr.sort((a, b) => a - b)[Math.min(arr.length - 1, Math.floor(arr.length * p))] : 0;
const report = (label, lat, errs) => {
  console.log(`\n${label}`);
  console.log(`  ok=${lat.length}  errors=${errs}`);
  if (lat.length) console.log(`  latency ms: min=${Math.min(...lat)} p50=${pct(lat,.5)} p95=${pct(lat,.95)} p99=${pct(lat,.99)} max=${Math.max(...lat)}`);
};

async function main() {
  console.log(`Load test: ${USERS} concurrent users → ${BASE}`);

  // 1) concurrent login (verify-otp issues the cookie)
  let t = Date.now();
  const loginLat = [], cookies = [];
  let loginErr = 0;
  await Promise.all(
    Array.from({ length: USERS }, (_, i) => (async () => {
      const s = Date.now();
      try {
        const res = await req('POST', '/api/auth/verify-otp', { body: { email: `loadtest.user${i}@${DOMAIN}`, otp: '1234' } });
        if (res.status === 200) { loginLat.push(Date.now() - s); cookies[i] = (res.headers['set-cookie']?.[0] || '').split(';')[0]; }
        else loginErr++;
      } catch { loginErr++; }
    })())
  );
  report(`LOGIN (wall ${Date.now() - t}ms)`, loginLat, loginErr);

  // 2) concurrent candidate-list fetch
  t = Date.now();
  const listLat = []; let listErr = 0;
  await Promise.all(cookies.map((cookie) => (async () => {
    const s = Date.now();
    try { const res = await req('GET', '/api/candidates', { cookie }); res.status === 200 ? listLat.push(Date.now() - s) : listErr++; }
    catch { listErr++; }
  })()));
  report(`LOAD CANDIDATES (wall ${Date.now() - t}ms)`, listLat, listErr);

  // 3) open SSE realtime streams and keep them open
  let sseOpen = 0, sseErr = 0;
  const streams = cookies.map((cookie) => new Promise((resolve) => {
    const u = new URL(BASE + '/api/stream');
    const r = http.request({ hostname: u.hostname, port: u.port, path: u.pathname, method: 'GET', headers: { Cookie: cookie, Accept: 'text/event-stream' } },
      (res) => { if (res.statusCode === 200) sseOpen++; else sseErr++; res.on('data', () => {}); resolve(r); });
    r.on('error', () => { sseErr++; resolve(null); });
    r.end();
  }));
  const streamReqs = await Promise.all(streams);
  await new Promise((r) => setTimeout(r, 1500));
  console.log(`\nSSE STREAMS: open=${sseOpen}  errors=${sseErr}`);

  // 4) everyone votes for a random candidate of each gender, concurrently
  const cands = JSON.parse((await req('GET', '/api/candidates', { cookie: cookies[0] })).body).candidates;
  const males = cands.filter((c) => c.gender === 'male'), females = cands.filter((c) => c.gender === 'female');
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  t = Date.now();
  const voteLat = []; let voteErr = 0;
  await Promise.all(cookies.flatMap((cookie) => [males, females].map((pool) => (async () => {
    const s = Date.now();
    try { const res = await req('POST', '/api/vote', { cookie, body: { candidateId: pick(pool).id } }); res.status === 200 ? voteLat.push(Date.now() - s) : voteErr++; }
    catch { voteErr++; }
  })())));
  report(`VOTE — ${USERS * 2} concurrent writes (wall ${Date.now() - t}ms)`, voteLat, voteErr);

  // 5) immediate re-vote (vote change) burst — stress the write path again
  t = Date.now();
  const reLat = []; let reErr = 0;
  await Promise.all(cookies.map((cookie) => (async () => {
    const s = Date.now();
    try { const res = await req('POST', '/api/vote', { cookie, body: { candidateId: pick(males).id } }); res.status === 200 ? reLat.push(Date.now() - s) : reErr++; }
    catch { reErr++; }
  })()));
  report(`VOTE CHANGE burst (wall ${Date.now() - t}ms)`, reLat, reErr);

  streamReqs.forEach((r) => r?.destroy());
  console.log('\nDone.');
  process.exit(0);
}
main();
