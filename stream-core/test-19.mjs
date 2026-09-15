/**
 * Smoke-test 19 real searches + stream length.
 * Usage: node test-19.mjs
 */
const BASE = process.env.CORE_URL || 'http://127.0.0.1:17321';

const QUERIES = [
  'Shadmehr Aghili Taghdir',
  'Ebi Hamsayeh',
  'Googoosh Nagoo',
  'Mohsen Chavoshi Khatereha',
  'Dariush Ersal',
  'Sirvan Khosravi Hatef',
  'Homayoun Shajarian Sogand',
  'Alireza Ghorbani',
  'Reza Sadeghi',
  'Morteza Pashaei',
  'Adele Hello',
  'The Weeknd Blinding Lights',
  'Ed Sheeran Shape of You',
  'Billie Eilish Bad Guy',
  'Daft Punk Get Lucky',
  'Queen Bohemian Rhapsody',
  'Michael Jackson Billie Jean',
  'Coldplay Yellow',
  'Eminem Lose Yourself',
];

async function headPlay(videoId) {
  const url = `${BASE}/play/${videoId}`;
  const res = await fetch(url, { method: 'GET', headers: { Range: 'bytes=0-1' } });
  const cl = res.headers.get('content-length');
  const cr = res.headers.get('content-range');
  const ct = res.headers.get('content-type') || '';
  // Drain a tiny bit
  try {
    await res.arrayBuffer();
  } catch {}
  let total = null;
  if (cr) {
    const m = /\/(\d+)\s*$/.exec(cr);
    if (m) total = Number(m[1]);
  } else if (cl) {
    total = Number(cl);
  }
  return { status: res.status, total, ct, cr };
}

function estimateSecs(bytes, ct) {
  if (!bytes) return 0;
  // ~128 kbps m4a ≈ 16 KB/s; opus ~12-16 KB/s
  const bytesPerSec = /mp4|m4a|aac/i.test(ct) ? 16000 : 14000;
  return bytes / bytesPerSec;
}

async function main() {
  const health = await fetch(`${BASE}/healthz`).then((r) => r.json());
  console.log('health', health);

  let pass = 0;
  let fail = 0;
  let short = 0;
  const rows = [];

  for (const q of QUERIES) {
    const t0 = Date.now();
    let song = null;
    let stream = null;
    let err = null;
    try {
      const sr = await fetch(`${BASE}/api/search?q=${encodeURIComponent(q)}&limit=5`);
      const data = await sr.json();
      song = data.songs?.[0];
      if (!song) throw new Error('no results');
      stream = await headPlay(song.videoId);
    } catch (e) {
      err = String(e.message || e);
    }
    const ms = Date.now() - t0;
    const est = stream ? Math.round(estimateSecs(stream.total, stream.ct)) : 0;
    const metaDur = song?.duration ? Number(song.duration) : 0;
    const okStream = stream && stream.status >= 200 && stream.status < 300;
    const fullish = est === 0 || est >= 90 || (metaDur > 0 && est >= metaDur * 0.7);
    // If range request, total is full file size — good.
    const isPreviewish = stream?.total && stream.total < 1_500_000 && metaDur > 90;

    let verdict = 'FAIL';
    if (err) verdict = 'ERR';
    else if (!okStream) verdict = `HTTP${stream.status}`;
    else if (isPreviewish) verdict = 'PREVIEW?';
    else if (est > 0 && est < 60) verdict = 'SHORT';
    else verdict = 'OK';

    if (verdict === 'OK') pass++;
    else if (verdict === 'SHORT' || verdict === 'PREVIEW?') short++;
    else fail++;

    rows.push({
      q,
      title: song?.title?.slice(0, 40),
      metaDur,
      bytes: stream?.total,
      estSecs: est,
      ms,
      verdict,
      err,
    });
    console.log(
      `${verdict.padEnd(8)} ${String(ms).padStart(5)}ms  meta=${String(metaDur).padStart(4)}s est=${String(est).padStart(4)}s bytes=${String(stream?.total ?? '-').padStart(10)}  ${song?.title?.slice(0, 40) || err}`
    );
  }

  console.log('\n=== SUMMARY ===');
  console.log(`OK: ${pass}  SHORT/PREVIEW: ${short}  FAIL: ${fail}  total: ${QUERIES.length}`);
  if (pass + short < QUERIES.length * 0.8) {
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
