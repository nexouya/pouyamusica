const BASE = 'http://127.0.0.1:17321';
const QUERIES = [
  'Shadmehr Taghdir',
  'Adele Hello',
  'Billie Jean Michael Jackson',
  'Shape of You',
  'bad guy Billie Eilish',
  'Bohemian Rhapsody',
  'Get Lucky Daft Punk',
  'Coldplay Yellow',
  'Blinding Lights',
  'Eminem Lose Yourself',
];
let ok = 0, fail = 0;
for (const q of QUERIES) {
  const t0 = Date.now();
  try {
    const s = await fetch(`${BASE}/api/search?q=${encodeURIComponent(q)}&limit=3`).then((r) => r.json());
    const song = s.songs?.find((x) => /^[A-Za-z0-9_-]{11}$/.test(x.videoId || ''));
    if (!song) throw new Error('no song');
    const r = await fetch(`${BASE}/play/${song.videoId}`, { headers: { Range: 'bytes=0-1023' } });
    const cr = r.headers.get('content-range');
    await r.arrayBuffer().catch(() => {});
    let total = 0;
    if (cr) {
      const m = /\/(\d+)\s*$/.exec(cr);
      if (m) total = Number(m[1]);
    }
    const good = r.status < 400 && total > 500_000;
    if (good) ok++;
    else fail++;
    console.log(
      `${good ? 'OK  ' : 'FAIL'} ${String(Date.now() - t0).padStart(6)}ms bytes=${String(total).padStart(10)} ${song.title?.slice(0, 36)}`
    );
  } catch (e) {
    fail++;
    console.log(`FAIL ${q}: ${e.message}`);
  }
}
console.log(`\nOK=${ok} FAIL=${fail} / ${QUERIES.length}`);
