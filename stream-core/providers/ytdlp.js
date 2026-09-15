/**
 * Provider that shells out to yt-dlp — the same tool the original Python
 * version used. It is the most reliable path: yt-dlp updates faster than
 * anything else when YouTube changes, and it honours system/environment proxy
 * settings that Node's fetch ignores.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPrimaryBrowser } from '../browserCookies.js';
import { writeCookiesFile } from '../chromeCookies.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const moduleRoot = path.resolve(__dirname, '..');

const run = promisify(execFile);

/** Parallel yt-dlp jobs (up to 4) with light spacing to reduce rate-limits. */
let active = 0;
const waiters = [];
let lastRun = 0;
const MAX_PARALLEL = 4;

function acquireSlot() {
  return new Promise((resolve) => {
    if (active < MAX_PARALLEL) {
      active++;
      resolve();
    } else {
      waiters.push(resolve);
    }
  });
}

function releaseSlot() {
  active--;
  const next = waiters.shift();
  if (next) {
    active++;
    next();
  }
}

function enqueueYtDlp(fn) {
  return (async () => {
    await acquireSlot();
    try {
      const wait = 180 - (Date.now() - lastRun);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      return await fn();
    } finally {
      lastRun = Date.now();
      releaseSlot();
    }
  })();
}

const LIVE_COOKIES = path.join(moduleRoot, 'cookies-live.txt');
const USER_COOKIES = path.join(moduleRoot, 'cookies-user.txt');
let liveCookiesAt = 0;
let preferBrowser = true;

// If Chrome is running, its cookie DB is locked — start on file cookies immediately.
try {
  if (process.platform === 'win32') {
    const { execSync } = await import('node:child_process');
    const out = execSync('tasklist /FI "IMAGENAME eq chrome.exe" /FO CSV /NH', {
      windowsHide: true,
      encoding: 'utf8',
      timeout: 3000,
    });
    if (/chrome\.exe/i.test(out)) preferBrowser = false;
  }
} catch {
  /* keep preferBrowser */
}

/** Chrome-first cookie resolution. */
async function cookieArgs() {
  // 1) Always try live Chrome cookies when allowed (user is signed in).
  if (preferBrowser && process.env.NO_BROWSER_COOKIES !== 'true') {
    return [
      { args: ['--cookies-from-browser', 'chrome'], browser: true },
    ];
  }
  // 2) Fallback: imported / extracted Netscape file.
  if (fsSync.existsSync(USER_COOKIES)) {
    return [{ args: ['--cookies', USER_COOKIES], browser: false }];
  }
  if (Date.now() - liveCookiesAt > 60_000 || !fsSync.existsSync(LIVE_COOKIES)) {
    try {
      writeCookiesFile(LIVE_COOKIES);
      liveCookiesAt = Date.now();
    } catch {
      /* ignore */
    }
  }
  if (fsSync.existsSync(LIVE_COOKIES)) {
    return [{ args: ['--cookies', LIVE_COOKIES], browser: false }];
  }
  return [{ args: [], browser: false }];
}

/** Every plausible way yt-dlp might be installed, in order of preference. */
function candidates() {
  if (process.env.YTDLP_PATH) return [{ cmd: process.env.YTDLP_PATH, prefix: [] }];
  
  const localModuleLinux = path.resolve(moduleRoot, 'bin', 'yt-dlp');
  const localModuleWin = path.resolve(moduleRoot, 'bin', 'yt-dlp.exe');
  const bundledLinux = path.resolve(process.cwd(), 'bin', 'yt-dlp');
  const bundledWin = path.resolve(process.cwd(), 'bin', 'yt-dlp.exe');
  const hasteFolderLinux = path.resolve(process.cwd(), 'haste strim', 'bin', 'yt-dlp');
  const hasteFolderWin = path.resolve(process.cwd(), 'haste strim', 'bin', 'yt-dlp.exe');

  return [
    ...(fsSync.existsSync(localModuleLinux) ? [{ cmd: localModuleLinux, prefix: [] }] : []),
    ...(fsSync.existsSync(localModuleWin) ? [{ cmd: localModuleWin, prefix: [] }] : []),
    ...(fsSync.existsSync(hasteFolderLinux) ? [{ cmd: hasteFolderLinux, prefix: [] }] : []),
    ...(fsSync.existsSync(hasteFolderWin) ? [{ cmd: hasteFolderWin, prefix: [] }] : []),
    ...(fsSync.existsSync(bundledLinux) ? [{ cmd: bundledLinux, prefix: [] }] : []),
    ...(fsSync.existsSync(bundledWin) ? [{ cmd: bundledWin, prefix: [] }] : []),
    { cmd: 'yt-dlp', prefix: [] },
    { cmd: 'yt-dlp.exe', prefix: [] },
    { cmd: 'python3', prefix: ['-m', 'yt_dlp'] },
    { cmd: 'python', prefix: ['-m', 'yt_dlp'] },
    { cmd: 'py', prefix: ['-m', 'yt_dlp'] }
  ];
}

let resolution = null;

/** Finds a working yt-dlp, remembering the answer. */
async function locate() {
  if (!resolution) {
    resolution = (async () => {
      for (const candidate of candidates()) {
        try {
          const { stdout } = await run(candidate.cmd, [...candidate.prefix, '--version'], {
            timeout: 20_000,
            windowsHide: true
          });
          return { ...candidate, version: stdout.trim() };
        } catch {
          /* try the next candidate */
        }
      }
      return null;
    })();
  }
  return resolution;
}

export async function isAvailable() {
  return (await locate()) !== null;
}

export async function version() {
  return (await locate())?.version ?? null;
}

/** Describes how yt-dlp is being invoked, for diagnostics. */
export async function describe() {
  const found = await locate();
  if (!found) return null;
  return { command: [found.cmd, ...found.prefix].join(' '), version: found.version };
}

function userCookiesSignedIn() {
  try {
    if (!fsSync.existsSync(USER_COOKIES)) return false;
    const text = fsSync.readFileSync(USER_COOKIES, 'utf8');
    return /(^|\t)(SID|HSID|__Secure-1PSID|__Secure-3PSID)\t/m.test(text);
  } catch {
    return false;
  }
}

async function ytdlp(args, options) {
  const found = await locate();
  if (!found) throw new Error('yt-dlp is not installed (try: pip install -U yt-dlp)');
  // Python already reads HTTPS_PROXY and the Windows registry, but a proxy set
  // only through our own PROXY_URL variable must be handed over explicitly.
  const proxyArgs = process.env.PROXY_URL ? ['--proxy', process.env.PROXY_URL] : [];

  const extraArgs = [];
  // Prefer imported signed-in file cookies — Chrome's DPAPI is often locked
  // while the browser is running (yt-dlp "Failed to decrypt with DPAPI").
  let usedBrowserCookies = false;
  if (process.env.NO_BROWSER_COOKIES !== 'true') {
    if (userCookiesSignedIn()) {
      extraArgs.push('--cookies', USER_COOKIES);
    } else if (preferBrowser) {
      extraArgs.push('--cookies-from-browser', 'chrome');
      usedBrowserCookies = true;
    } else if (fsSync.existsSync(USER_COOKIES)) {
      extraArgs.push('--cookies', USER_COOKIES);
    } else if (fsSync.existsSync(LIVE_COOKIES)) {
      extraArgs.push('--cookies', LIVE_COOKIES);
    }
  }

  // yt-dlp needs a JS runtime for signature / n-challenge solving.
  const nodeBin =
    process.env.YTDLP_NODE ||
    (fsSync.existsSync('C:\\Program Files\\nodejs\\node.exe')
      ? 'C:\\Program Files\\nodejs\\node.exe'
      : 'node');
  extraArgs.push('--js-runtimes', `node:${nodeBin}`);

  const stripBrowserCookies = (list) =>
    list.filter((a, i, arr) => a !== '--cookies-from-browser' && arr[i - 1] !== '--cookies-from-browser' && a !== 'chrome');

  try {
    return await enqueueYtDlp(() =>
      run(found.cmd, [...found.prefix, ...proxyArgs, ...extraArgs, ...args], { windowsHide: true, ...options })
    );
  } catch (err) {
    const stderr = String(err.stderr || err.message || '');
    // Chrome DB locked / DPAPI decrypt → switch to file cookies and retry once.
    if (
      usedBrowserCookies &&
      /Could not copy Chrome cookie database|Failed to decrypt with DPAPI|DPAPI|cookie database/i.test(stderr)
    ) {
      preferBrowser = false;
      console.warn('[ytdlp] Chrome cookies unavailable — falling back to cookies-user.txt');
      const fileArgs = fsSync.existsSync(USER_COOKIES)
        ? ['--cookies', USER_COOKIES]
        : fsSync.existsSync(LIVE_COOKIES)
          ? ['--cookies', LIVE_COOKIES]
          : [];
      try {
        return await enqueueYtDlp(() =>
          run(
            found.cmd,
            [...found.prefix, ...proxyArgs, ...fileArgs, ...stripBrowserCookies(extraArgs), ...args],
            { windowsHide: true, ...options }
          )
        );
      } catch (err2) {
        const s2 = String(err2.stderr || err2.message || '');
        if (/Sign in to confirm/i.test(s2)) {
          throw new Error(
            'Chrome is locked and cookies-user.txt is stale. Close Chrome once, or re-export cookies from youtube.com.'
          );
        }
        throw err2;
      }
    }
    if (/Sign in to confirm/i.test(stderr)) {
      // Retry once with file cookies even if we started from browser.
      const fileArgs = fsSync.existsSync(USER_COOKIES)
        ? ['--cookies', USER_COOKIES]
        : [];
      if (fileArgs.length) {
        preferBrowser = false;
        try {
          return await enqueueYtDlp(() =>
            run(
              found.cmd,
              [...found.prefix, ...proxyArgs, ...fileArgs, ...stripBrowserCookies(extraArgs), ...args],
              { windowsHide: true, ...options }
            )
          );
        } catch {
          /* fall through */
        }
      }
      throw new Error(
        'YouTube rejected this session. Keep Chrome signed into youtube.com, or Import cookies in Online.'
      );
    }
    throw err;
  }
}

function assertVideoId(videoId) {
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
    throw new Error('invalid video id');
  }
}

export async function search(query, limit = 10) {
  const count = Math.min(Math.max(Number(limit) || 10, 1), 25);
  const { stdout } = await ytdlp(
    ['--flat-playlist', '--dump-json', '--no-warnings', `ytsearch${count}:${query}`],
    { timeout: 90_000, maxBuffer: 20 * 1024 * 1024 }
  );

  return stdout
    .split('\n')
    .filter((line) => line.trim().startsWith('{'))
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter((entry) => entry?.id && /^[A-Za-z0-9_-]{11}$/.test(entry.id))
    // Skip channels / playlists accidentally returned by search.
    .filter((entry) => {
      const t = String(entry._type || entry.type || '');
      if (t.includes('channel') || t.includes('playlist')) return false;
      if (String(entry.ie_key || '').toLowerCase().includes('channel')) return false;
      return true;
    })
    .map((entry) => {
      let rawThumb = entry.thumbnails?.at(-1)?.url;
      if (rawThumb && rawThumb.includes('googleusercontent.com')) {
        rawThumb = rawThumb.replace(/=w\d+-h\d+[^?&]*/, '=w1200-h1200-l90-rj').replace(/=s\d+[^?&]*/, '=s1200');
      } else if (rawThumb && (rawThumb.includes('i.ytimg.com') || rawThumb.includes('img.youtube.com'))) {
        rawThumb = rawThumb.replace(/(hqdefault|mqdefault|sddefault|default)\.jpg/, 'maxresdefault.jpg');
      } else if (!rawThumb) {
        rawThumb = `https://i.ytimg.com/vi/${entry.id}/maxresdefault.jpg`;
      }
      return {
        videoId: entry.id,
        title: entry.title ?? 'Untitled',
        artist: entry.artist ?? entry.uploader ?? entry.channel ?? '',
        duration: entry.duration ?? null,
        thumbnail: rawThumb
      };
    });
}

/**
 * Player clients that return progressive (non-HLS) audio URLs.
 * android is the proven fast lane (same as the reference download engine).
 * web_safari/android/ios/web can prefer HLS playlists, which HTMLAudio
 * cannot play — keep those out of the primary attempt.
 */
const STREAM_CLIENT_ATTEMPTS = [
  'android',
  'android_vr,tv,web_embedded,mweb',
  'tv,web_embedded,mweb,android_vr',
  null, // default lets yt-dlp pick
  'web_safari,android,ios,web', // last resort (may be HLS)
];

function isHlsUrl(url) {
  return url.includes('.m3u8') || url.includes('/manifest/hls');
}

function parseStreamUrl(stdout) {
  return stdout
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.startsWith('http'));
}

export async function resolveStream(videoId) {
  assertVideoId(videoId);
  const format = [
    '-f',
    // Prefer progressive HTTP; still accept bestaudio if that's all we get.
    'bestaudio[ext=m4a][protocol^=http]/bestaudio[protocol^=http]/bestaudio[ext=m4a]/bestaudio/best',
    '-g',
    '--no-playlist',
    '--no-warnings',
    `https://www.youtube.com/watch?v=${videoId}`,
  ];

  let lastError = null;
  let hlsFallback = null;

  for (const client of STREAM_CLIENT_ATTEMPTS) {
    const args = client
      ? [...format.slice(0, 2), '--extractor-args', `youtube:player_client=${client}`, ...format.slice(2)]
      : format;
    try {
      const { stdout } = await ytdlp(args, { timeout: 90_000 });
      const url = parseStreamUrl(stdout);
      if (!url) {
        lastError = new Error('yt-dlp returned no stream url');
        continue;
      }
      if (isHlsUrl(url)) {
        // Keep as last resort; disk-download path can still fetch the track.
        if (!hlsFallback) hlsFallback = url;
        lastError = new Error(`client ${client || 'default'} returned HLS only`);
        continue;
      }
      return {
        url,
        mimeType: url.includes('.webm') || url.includes('mime=audio%2Fwebm')
          ? 'audio/webm'
          : 'audio/mp4',
        contentLength: null,
        via: `yt-dlp${client ? `:${client.split(',')[0]}` : ''}`
      };
    } catch (error) {
      lastError = error;
    }
  }

  if (hlsFallback) {
    return {
      url: hlsFallback,
      mimeType: 'application/x-mpegURL',
      contentLength: null,
      via: 'yt-dlp:hls'
    };
  }
  throw lastError ?? new Error('yt-dlp could not resolve a stream url');
}

/**
 * Downloads audio to `directory` using yt-dlp's own network stack.
 *
 * Downloads into a temporary subdirectory and moves the finished file into
 * place, so an interrupted download can never leave a truncated file behind
 * that a later request would happily serve as "cached".
 *
 * @returns {Promise<string>} absolute path to the downloaded file
 */
export async function download(videoId, directory) {
  assertVideoId(videoId);
  await fs.mkdir(directory, { recursive: true });
  const staging = await fs.mkdtemp(path.join(directory, `.tmp-${videoId}-`));

  try {
    // android client is the reliable fast lane (same as the reference engine).
    // Fall through a few client sets if the first returns nothing usable.
    const clientSets = [
      'android',
      'android_vr,tv,web_embedded,mweb',
      'web_safari,android,ios,web',
    ];
    let lastErr = null;
    let produced = null;

    for (const clients of clientSets) {
      try {
        await ytdlp(
          [
            '-f', 'bestaudio[ext=m4a][protocol^=http]/bestaudio[protocol^=http]/bestaudio[ext=m4a]/ba/b',
            '--extractor-args', `youtube:player_client=${clients}`,
            '--no-playlist',
            '--no-part',
            '--no-progress',
            '--no-warnings',
            '--retries', '5',
            '--socket-timeout', '30',
            '-o', path.join(staging, `${videoId}.%(ext)s`),
            `https://www.youtube.com/watch?v=${videoId}`
          ],
          { timeout: 3 * 60_000, maxBuffer: 10 * 1024 * 1024 }
        );
        produced = (await fs.readdir(staging)).find((entry) => entry.startsWith(`${videoId}.`));
        if (produced) break;
      } catch (error) {
        lastErr = error;
        // Clear partials before the next client attempt.
        for (const entry of await fs.readdir(staging)) {
          await fs.rm(path.join(staging, entry), { force: true }).catch(() => {});
        }
      }
    }

    if (!produced) {
      throw lastErr ?? new Error('yt-dlp produced no audio file');
    }

    const source = path.join(staging, produced);
    const { size } = await fs.stat(source);
    // Real tracks are hundreds of KB minimum; playlists/errors are tiny.
    if (size < 50 * 1024) {
      throw new Error(`downloaded file is only ${size} bytes — likely not a full track`);
    }

    const target = path.join(directory, produced);
    await fs.rename(source, target); // atomic: same filesystem
    return target;
  } finally {
    await fs.rm(staging, { recursive: true, force: true });
  }
}

export const name = 'yt-dlp';
