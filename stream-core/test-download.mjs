/**
 * Verify /download produces a real audio file body (not HLS / not error page).
 */
const BASE = process.env.BASE || 'http://127.0.0.1:17321';
const videoId = process.argv[2] || 'uJdu4Lfy8aI'; // Adele - Set Fire to the Rain

const res = await fetch(`${BASE}/download/${videoId}?title=TestTrack`);
const buf = Buffer.from(await res.arrayBuffer());
const ct = res.headers.get('content-type') || '';
const cd = res.headers.get('content-disposition') || '';
const magic = buf.slice(0, 16).toString('latin1');
const hls = /mpegurl|m3u8/i.test(ct) || magic.startsWith('#EXTM3U');
const isAudio = magic.includes('ftyp') || magic.includes('webm') || buf[0] === 0xff || magic.startsWith('ID3');
const good = res.status < 400 && !hls && buf.length > 200_000 && isAudio;

console.log({
  status: res.status,
  bytes: buf.length,
  contentType: ct,
  contentDisposition: cd,
  magic: magic.replace(/[^\x20-\x7e]/g, '.'),
  hls,
  isAudio,
  good,
});
process.exitCode = good ? 0 : 1;
