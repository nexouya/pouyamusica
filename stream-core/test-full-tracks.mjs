/**
 * Verify full-length audio for N queries.
 * Uses yt-dlp -g to resolve progressive URL and checks Content-Length / duration.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const YTDLP = path.join(__dirname, 'bin', 'yt-dlp.exe');
const COOKIES = path.join(__dirname, 'cookies-user.txt');

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
  'Adele Hello official',
  'The Weeknd Blinding Lights',
  'Ed Sheeran Shape of You',
  'Billie Eilish bad guy',
  'Daft Punk Get Lucky',
  'Queen Bohemian Rhapsody',
  'Michael Jackson Billie Jean',
  'Coldplay Yellow',
  'Eminem Lose Yourself',
];

function parseDuration(d) {
  if (typeof d === 'number') return d;
  if (!d) return 0;
  const p = String(d).split(':').map(Number);
  if (p.length === 3) return p[0] * 3600 + p[1] * 60 + p[2];
  if (p.length === 2) return p[0] * 60 + p[1];
  return 0;
}

async function searchFirst(q) {
  const { stdout } = await run(
    YTDLP,
    [
      '--cookies', COOKIES,
      '--js-runtimes', 'node',
      '--flat-playlist', '--dump-json', '--no-warnings',
      `ytsearch1:${q}`,
    ],
    { timeout: 60_000, maxBuffer: 8 * 1024 * 1024 }
  );
  const line = stdout.split('\n').find((l) => l.trim().startsWith('{'));
  return JSON.parse(line);
}

async function resolveUrl(id) {
  const { stdout } = await run(
    YTDLP,
    [
      '--cookies', COOKIES,
      '--js-runtimes', 'node',
      '-f', 'bestaudio[ext=m4a][protocol^=http]/bestaudio[protocol^=http]/bestaudio/best',
      '--extractor-args', 'youtube:player_client=web_safari,android,ios,web',
      '-g', '--no-playlist', '--no-warnings',
      `https://www.youtube.com/watch?v=${id}`,
    ],
    { timeout: 90_000 }
  );
  return stdout.split('\n').map((s) => s.trim()).find((s) => s.startsWith('http'));
}

async function probe(url) {
  const res = await fetch(url, {
    method: 'GET',
    headers: { Range: 'bytes=0-1023', 'User-Agent': 'Mozilla/5.0' },
  });
  const cr = res.headers.get('content-range');
  const cl = res.headers.get('content-length');
  const ct = res.headers.get('content-type') || '';
  await res.arrayBuffer().catch(() => {});
  let total = null;
  if (cr) {
    const m = /\/(\d+)\s*$/.exec(cr);
    if (m) total = Number(m[1]);
  }
  return { status: res.status, total, cl, ct, hls: /\.m3u8|\/manifest\/hls/i.test(url) };
}

function estSecs(bytes, hls) {
  if (hls || !bytes) return 0;
  return Math.round(bytes / 16000); // ~128kbps
}

let ok = 0, short = 0, fail = 0;
for (const q of QUERIES) {
  const t0 = Date.now();
  try {
    const song = await searchFirst(q);
    const url = await resolveUrl(song.id);
    if (!url) throw new Error('no url');
    const p = await probe(url);
    const meta = parseDuration(song.duration);
    const est = estSecs(p.total, p.hls);
    const fullish = p.hls || (est >= 90 || (meta > 90 && est >= meta * 0.65));
    const v = p.status >= 400 ? `HTTP${p.status}` : fullish ? 'OK' : 'SHORT';
    if (v === 'OK') ok++;
    else if (v === 'SHORT') short++;
    else fail++;
    console.log(
      `${v.padEnd(6)} ${String(Date.now() - t0).padStart(5)}ms meta=${String(meta).padStart(4)}s bytes=${String(p.total ?? '-').padStart(10)} hls=${p.hls} ${String(song.title).slice(0, 42)}`
    );
  } catch (e) {
    fail++;
    console.log(`FAIL   ${q}: ${e.message}`);
  }
}
console.log(`\nOK=${ok} SHORT=${short} FAIL=${fail} / ${QUERIES.length}`);
process.exitCode = ok < QUERIES.length * 0.8 ? 1 : 0;
