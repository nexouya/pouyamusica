/**
 * Convert browser-extension cookie JSON (EditThisCookie / Get cookies.txt style)
 * into Netscape cookies.txt for yt-dlp.
 *
 * Usage: node import-cookie-json.mjs <input.json> <output.txt>
 */
import fs from 'node:fs';

function toNetscape(cookies) {
  const lines = ['# Netscape HTTP Cookie File', '# imported by pouya-music', ''];
  for (const c of cookies) {
    if (!c?.name || c.value == null) continue;
    const domain = c.domain || '';
    if (!domain.includes('youtube.com') && !domain.includes('google.com') && !domain.includes('googlevideo.com')) {
      continue;
    }
    const includeSub = domain.startsWith('.') ? 'TRUE' : 'FALSE';
    const secure = c.secure ? 'TRUE' : 'FALSE';
    let expires = 0;
    if (c.expirationDate) {
      expires = Math.floor(Number(c.expirationDate));
    }
    const path = c.path || '/';
    const value = String(c.value);
    if (/[\t\r\n]/.test(value)) {
      console.warn('skip cookie with whitespace in value:', c.name);
      continue;
    }
    lines.push([domain, includeSub, path, secure, expires, c.name, value].join('\t'));
  }
  return lines.join('\n') + '\n';
}

const [, , inPath, outPath] = process.argv;
if (!inPath || !outPath) {
  console.error('usage: node import-cookie-json.mjs cookies.json cookies.txt');
  process.exit(1);
}
const raw = JSON.parse(fs.readFileSync(inPath, 'utf8'));
const list = Array.isArray(raw) ? raw : raw.cookies || [];
const text = toNetscape(list);
fs.writeFileSync(outPath, text, 'utf8');
const auth = /(^|\t)(SID|HSID|__Secure-1PSID|__Secure-3PSID)\t/m.test(text);
console.log('wrote', outPath, 'bytes', Buffer.byteLength(text), 'signedIn', auth);
