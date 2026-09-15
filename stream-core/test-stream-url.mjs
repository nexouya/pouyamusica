import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Innertube, UniversalCache } from 'youtubei.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ckPath = path.join(__dirname, 'cookies-user.txt');

function cookieHeaderFromNetscape(file) {
  const pairs = [];
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line || line.startsWith('#')) continue;
    const parts = line.split('\t');
    if (parts.length < 7) continue;
    const value = parts[6].replace(/[\r\n]+/g, '');
    if (!/^[ -~]+$/.test(value)) continue;
    pairs.push(`${parts[5]}=${value}`);
  }
  return pairs.join('; ');
}

const cookie = cookieHeaderFromNetscape(ckPath);
const yt = await Innertube.create({
  cache: new UniversalCache(false),
  generate_session_locally: true,
  retrieve_player: true,
  cookie,
});

const id = process.argv[2] || 'yjo_aXygRDI';
const info = await yt.getBasicInfo(id);
console.log('title', info.basic_info?.title, 'dur', info.basic_info?.duration);

const adaptive = info.streaming_data?.adaptive_formats || [];
const audio = adaptive.filter((f) => String(f.mime_type || '').startsWith('audio'));
console.log('audio count', audio.length, audio.map((a) => `${a.itag}:${a.mime_type?.split(';')[0]}`).join(', '));

// Try several ways to get a playable URL
for (const fmt of audio) {
  try {
    const url = fmt.url
      || (typeof fmt.decipher === 'function' ? await fmt.decipher(info.player) : null)
      || null;
    console.log('itag', fmt.itag, 'url?', !!url, url ? String(url).slice(0, 90) : '');
    if (url) {
      const res = await fetch(url, { headers: { Range: 'bytes=0-1023', 'User-Agent': 'Mozilla/5.0' } });
      console.log('  fetch', res.status, 'cl', res.headers.get('content-length'), 'cr', res.headers.get('content-range'), 'ct', res.headers.get('content-type'));
      await res.arrayBuffer();
      if (res.ok || res.status === 206) {
        console.log('SUCCESS itag', fmt.itag);
        break;
      }
    }
  } catch (e) {
    console.log('itag', fmt.itag, 'err', e.message);
  }
}
