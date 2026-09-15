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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const moduleRoot = path.resolve(__dirname, '..');

const run = promisify(execFile);

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

async function ytdlp(args, options) {
  const found = await locate();
  if (!found) throw new Error('yt-dlp is not installed (try: pip install -U yt-dlp)');
  // Python already reads HTTPS_PROXY and the Windows registry, but a proxy set
  // only through our own PROXY_URL variable must be handed over explicitly.
  const proxyArgs = process.env.PROXY_URL ? ['--proxy', process.env.PROXY_URL] : [];

  const extraArgs = [];
  // Cookie resolution strategy:
  // 1. If running on desktop / Electron, prioritize live browser cookies from Chrome/Edge/Brave/Firefox
  // 2. If COOKIES_FILE is specified or cookies.txt exists, use that as secondary fallback
  const browser = process.env.NO_BROWSER_COOKIES !== 'true' ? (process.env.BROWSER_COOKIES || getPrimaryBrowser()) : null;
  const cookieCandidates = [
    process.env.COOKIES_FILE,
    path.resolve(moduleRoot, 'cookies.txt'),
    path.resolve(process.cwd(), 'cookies.txt'),
    path.resolve(process.cwd(), 'haste strim', 'cookies.txt')
  ].filter(Boolean);
  const cookiePath = cookieCandidates.find(p => fsSync.existsSync(p));
  let usedBrowserCookies = false;

  if (browser) {
    extraArgs.push('--cookies-from-browser', browser);
    usedBrowserCookies = true;
  } else if (cookiePath) {
    extraArgs.push('--cookies', cookiePath);
  }

  // Supply node as JS runtime if present
  if (fsSync.existsSync('/usr/local/bin/node')) {
    extraArgs.push('--js-runtimes', 'node:/usr/local/bin/node');
  }

  try {
    return await run(found.cmd, [...found.prefix, ...proxyArgs, ...extraArgs, ...args], { windowsHide: true, ...options });
  } catch (err) {
    // If it failed specifically because of browser cookies (e.g. Chrome locked or not installed), retry once without --cookies-from-browser
    if (usedBrowserCookies && (err.stderr?.includes('cookies') || err.message?.includes('cookies'))) {
      console.warn('Browser cookie extraction notice, retrying yt-dlp without browser cookies:', err.stderr?.slice(0, 100));
      const fallbackArgs = extraArgs.filter((a, idx, arr) => a !== '--cookies-from-browser' && arr[idx - 1] !== '--cookies-from-browser');
      return await run(found.cmd, [...found.prefix, ...proxyArgs, ...fallbackArgs, ...args], { windowsHide: true, ...options });
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

export async function resolveStream(videoId) {
  assertVideoId(videoId);
  const { stdout } = await ytdlp(
    [
      '-f', 'bestaudio[ext=m4a]/bestaudio/best',
      '--extractor-args', 'youtube:player_client=android,ios,web',
      '-g',
      '--no-playlist',
      '--no-warnings',
      `https://www.youtube.com/watch?v=${videoId}`
    ],
    { timeout: 90_000 }
  );

  const url = stdout.split('\n').map((l) => l.trim()).find((line) => line.startsWith('http'));
  if (!url) throw new Error('yt-dlp returned no stream url');

  return { url, mimeType: 'audio/mp4', contentLength: null, via: 'yt-dlp' };
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
    await ytdlp(
      [
        // m4a/AAC first: every browser decodes it. WebM/Opus is YouTube's usual
        // default, but Safari can't play it.
        '-f', 'bestaudio[ext=m4a]/bestaudio/best',
        '--extractor-args', 'youtube:player_client=android,ios,web',
        '--no-playlist',
        '--no-part',
        '--no-progress',
        '--no-warnings',
        '--retries', '5',
        '--socket-timeout', '30',
        '-o', path.join(staging, `${videoId}.%(ext)s`),
        `https://www.youtube.com/watch?v=${videoId}`
      ],
      { timeout: 8 * 60_000, maxBuffer: 10 * 1024 * 1024 }
    );

    const produced = (await fs.readdir(staging)).find((entry) => entry.startsWith(`${videoId}.`));
    if (!produced) throw new Error('yt-dlp finished but produced no file');

    const source = path.join(staging, produced);
    const { size } = await fs.stat(source);
    if (size < 1024) throw new Error(`downloaded file is only ${size} bytes`);

    const target = path.join(directory, produced);
    await fs.rename(source, target); // atomic: same filesystem
    return target;
  } finally {
    await fs.rm(staging, { recursive: true, force: true });
  }
}

export const name = 'yt-dlp';
