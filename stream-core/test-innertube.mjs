import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Innertube, UniversalCache } from 'youtubei.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ckPath = path.join(__dirname, process.argv[3] || 'cookies-user.txt');

function cookieHeaderFromNetscape(file) {
  const pairs = [];
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line || line.startsWith('#')) continue;
    const parts = line.split('\t');
    if (parts.length < 7) continue;
    const name = parts[5];
    const value = parts[6].replace(/[\r\n]+/g, '');
    if (!/^[\x21-\x7E]+$/.test(value) && !/^[\x20-\x7E]+$/.test(value)) continue;
    pairs.push(`${name}=${value}`);
  }
  return pairs.join('; ');
}

const cookie = cookieHeaderFromNetscape(ckPath);
console.log('pairs', cookie.split(';').length, 'len', cookie.length);

const yt = await Innertube.create({
  cache: new UniversalCache(false),
  generate_session_locally: true,
  retrieve_player: true,
  cookie,
});

const id = process.argv[2] || 'yjo_aXygRDI';
try {
  const info = await yt.getBasicInfo(id);
  console.log('title', info.basic_info?.title);
  console.log('duration', info.basic_info?.duration);
  const formats = info.streaming_data?.formats || [];
  const adaptive = info.streaming_data?.adaptive_formats || [];
  console.log('formats', formats.length, 'adaptive', adaptive.length);
  const audio = adaptive.filter((f) => String(f.mime_type || '').startsWith('audio'));
  console.log('audio formats', audio.length);
  if (audio[0]) {
    console.log('first audio', audio[0].itag, audio[0].mime_type, audio[0].bitrate, !!audio[0].url);
    if (audio[0].url) console.log('url', String(audio[0].url).slice(0, 80));
  }
} catch (e) {
  console.error('FAIL', e.message);
}
