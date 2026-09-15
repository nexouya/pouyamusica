/**
 * Second wave: fresh uncached queries to prove first-play downloads work.
 */
const BASE = process.env.BASE || 'http://127.0.0.1:17321';

const QUERIES = [
  'Hozier Take Me To Church',
  'Lewis Capaldi Someone You Loved',
  'Dua Lipa Levitating',
  'Harry Styles As It Was',
  'Olivia Rodrigo drivers license',
  'Imagine Dragons Believer',
  'Mark Ronson Uptown Funk',
  'Pharrell Williams Happy',
  'Adele Rolling in the Deep',
  'Linkin Park Numb',
  'Ebi Nima',
  'Dariush Ersal',
];

function parseTotal(cr, cl) {
  if (cr) {
    const m = /\/(\d+)\s*$/.exec(cr);
    if (m) return Number(m[1]);
  }
  return Number(cl) || 0;
}

let ok = 0;
let fail = 0;

for (const q of QUERIES) {
  const t0 = Date.now();
  try {
    const s = await fetch(`${BASE}/api/search?q=${encodeURIComponent(q)}&limit=2`).then((r) => r.json());
    const song = s.songs?.find((x) => /^[A-Za-z0-9_-]{11}$/.test(x.videoId || ''));
    if (!song) throw new Error('no song');
    const r = await fetch(`${BASE}/play/${song.videoId}`, { headers: { Range: 'bytes=0-1023' } });
    const total = parseTotal(r.headers.get('content-range'), r.headers.get('content-length'));
    const ct = r.headers.get('content-type') || '';
    const buf = Buffer.from(await r.arrayBuffer().catch(() => new ArrayBuffer(0)));
    const hls = /mpegurl|m3u8/i.test(ct) || buf.slice(0, 7).toString('utf8') === '#EXTM3U';
    const good = r.status < 400 && !hls && total > 500_000;
    if (good) ok++;
    else fail++;
    console.log(
      `${good ? 'OK  ' : 'FAIL'} ${String(Date.now() - t0).padStart(6)}ms bytes=${String(total).padStart(10)} dur=${song.duration ?? '?'} ${String(song.title).slice(0, 42)}`
    );
  } catch (e) {
    fail++;
    console.log(`FAIL ${q}: ${e.message}`);
  }
}
console.log(`\nOK=${ok} FAIL=${fail} / ${QUERIES.length}`);
process.exitCode = fail ? 1 : 0;
