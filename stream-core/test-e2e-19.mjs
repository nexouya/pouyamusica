/**
 * End-to-end: search + /play content-length for N tracks.
 */
const BASE = process.env.CORE_URL || 'http://127.0.0.1:17321';

const QUERIES = [
  'Shadmehr Aghili Taghdir',
  'Ebi Hamsayeh',
  'Googoosh Nagoo Bedroud',
  'Mohsen Chavoshi',
  'Sirvan Khosravi',
  'Homayoun Shajarian',
  'Morteza Pashaei Negarane Mani',
  'Adele Hello Official',
  'The Weeknd Blinding Lights',
  'Ed Sheeran Shape of You',
  'Billie Eilish bad guy',
  'Daft Punk Get Lucky',
  'Queen Bohemian Rhapsody',
  'Michael Jackson Billie Jean',
  'Coldplay Yellow',
  'Eminem Lose Yourself',
  'Drake One Dance',
  'Justin Bieber Sorry',
  'Rihanna Diamonds',
];

async function main() {
  const health = await fetch(`${BASE}/healthz`).then((r) => r.json());
  console.log('health', health);

  let ok = 0, fail = 0;
  for (const q of QUERIES) {
    const t0 = Date.now();
    try {
      const sr = await fetch(`${BASE}/api/search?q=${encodeURIComponent(q)}&limit=5`);
      const data = await sr.json();
      const song = (data.songs || []).find((s) => s.videoId && /^[A-Za-z0-9_-]{11}$/.test(s.videoId));
      if (!song) throw new Error('no video result');

      // Full download to cache then range-read (first play may take a while).
      const pr = await fetch(`${BASE}/play/${song.videoId}`, {
        headers: { Range: 'bytes=0-1023' },
      });
      const cr = pr.headers.get('content-range');
      const ct = pr.headers.get('content-type') || '';
      await pr.arrayBuffer().catch(() => {});
      let total = 0;
      if (cr) {
        const m = /\/(\d+)\s*$/.exec(cr);
        if (m) total = Number(m[1]);
      }
      // Full song ≈ 1MB+ for 3+ min at 128kbps+; reject tiny previews (<1.2MB when meta>90s)
      const meta = Number(song.duration) || 0;
      const looksFull = total > 1_200_000 || (meta > 0 && total > meta * 8000);
      const isPreview = total > 0 && total < 1_200_000 && meta > 90;
      const v = pr.status >= 400 ? `HTTP${pr.status}` : isPreview ? 'PREVIEW' : looksFull ? 'OK' : 'CHECK';
      if (v === 'OK') ok++;
      else fail++;
      console.log(
        `${v.padEnd(8)} ${String(Date.now() - t0).padStart(6)}ms bytes=${String(total).padStart(10)} meta=${String(meta).padStart(4)}s ${String(song.title).slice(0, 40)}`
      );
    } catch (e) {
      fail++;
      console.log(`FAIL     ${String(Date.now() - t0).padStart(6)}ms  ${q}: ${e.message}`);
    }
  }
  console.log(`\n=== OK=${ok} FAIL=${fail} / ${QUERIES.length} ===`);
  process.exitCode = ok < 15 ? 1 : 0;
}

main();
