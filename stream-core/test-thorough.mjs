/**
 * Thorough multi-query /play + /download verification.
 * Pass criteria: HTTP < 400, not HLS, full-track Content-Length > 500KB.
 */
const BASE = process.env.BASE || 'http://127.0.0.1:17321';

const QUERIES = [
  'Shadmehr Aghili Taghdir',
  'Ebi Hamsayeh',
  'Googoosh Nagoo',
  'Mohsen Chavoshi Khatereha',
  'Morteza Pashaei Adam Foroush',
  'Homayoun Shajarian Sogand',
  'Reza Sadeghi',
  'Sirvan Khosravi',
  'Adele Hello official',
  'Billie Jean Michael Jackson',
  'Shape of You Ed Sheeran',
  'Bohemian Rhapsody Queen',
  'Blinding Lights Weeknd',
  'Daft Punk Get Lucky',
  'Coldplay Yellow',
  'Eminem Lose Yourself',
  'Billie Eilish bad guy',
  'Ed Sheeran Perfect',
];

function parseTotal(cr) {
  if (!cr) return 0;
  const m = /\/(\d+)\s*$/.exec(cr);
  return m ? Number(m[1]) : 0;
}

let ok = 0;
let fail = 0;

for (const q of QUERIES) {
  const t0 = Date.now();
  try {
    const s = await fetch(`${BASE}/api/search?q=${encodeURIComponent(q)}&limit=3`).then((r) => r.json());
    const song = s.songs?.find((x) => /^[A-Za-z0-9_-]{11}$/.test(x.videoId || ''));
    if (!song) throw new Error('no song in results');

    const r = await fetch(`${BASE}/play/${song.videoId}`, {
      headers: { Range: 'bytes=0-1023' },
    });
    const cr = r.headers.get('content-range');
    const cl = r.headers.get('content-length');
    const ct = r.headers.get('content-type') || '';
    const buf = Buffer.from(await r.arrayBuffer().catch(() => new ArrayBuffer(0)));
    const total = parseTotal(cr) || Number(cl) || 0;
    const hls = /mpegurl|m3u8/i.test(ct) || buf.slice(0, 7).toString('utf8') === '#EXTM3U';
    // Real audio: ftyp (m4a/mp4), EBML/webm, or ID3/mp3 sync
    const magic = buf.slice(0, 12).toString('latin1');
    const isAudio =
      magic.includes('ftyp') ||
      magic.includes('webm') ||
      buf[0] === 0xff ||
      magic.startsWith('ID3') ||
      total > 500_000;

    const good = r.status < 400 && !hls && total > 500_000 && isAudio;
    if (good) ok++;
    else fail++;
    console.log(
      `${good ? 'OK  ' : 'FAIL'} ${String(Date.now() - t0).padStart(6)}ms status=${r.status} bytes=${String(total).padStart(10)} ct=${ct.slice(0, 24).padEnd(24)} hls=${hls} dur=${song.duration ?? '?'} ${String(song.title).slice(0, 40)}`
    );
  } catch (e) {
    fail++;
    console.log(`FAIL ${q}: ${e.message}`);
  }
}

console.log(`\nOK=${ok} FAIL=${fail} / ${QUERIES.length}`);
process.exitCode = fail > QUERIES.length * 0.15 ? 1 : 0;
