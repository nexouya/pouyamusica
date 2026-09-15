import { Readable } from 'node:stream';
/**
 * Audio delivery, with two strategies:
 *
 *  1. `proxy`  — resolve the CDN url and stream it through fetch(). Fast, no
 *                disk use, full range support.
 *  2. `ytdlp`  — let yt-dlp download the track using its own network stack,
 *                then serve the file from disk with range support.
 *
 * Strategy 2 exists because yt-dlp honours system/environment proxy settings
 * that Node's fetch does not. On a machine where fetch can't reach YouTube,
 * strategy 1 fails and strategy 2 still plays music. `auto` tries 1, remembers
 * if it fails, and uses 2 from then on.
 */

import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

const MIME_BY_EXT = {
  '.webm': 'audio/webm',
  '.m4a': 'audio/mp4',
  '.mp4': 'audio/mp4',
  '.opus': 'audio/ogg',
  '.ogg': 'audio/ogg',
  '.mp3': 'audio/mpeg'
};

const MAX_CACHE_FILES = 40;

function looksLikeHls(bodyText) {
  return /^#EXTM3U/i.test(String(bodyText || '').trimStart());
}

function contentTypeIsHls(contentType) {
  const ct = String(contentType || '').toLowerCase();
  return (
    ct.includes('mpegurl') ||
    ct.includes('x-mpegURL'.toLowerCase()) ||
    ct.includes('application/vnd.apple.mpegurl') ||
    ct.includes('application/x-mpegurl')
  );
}

function urlLooksLikeHls(url) {
  const u = String(url || '');
  return u.includes('.m3u8') || u.includes('/manifest/hls') || u.includes('hls_playlist');
}

export function createAudioStreamer({
  resolveStream,
  download,
  fetch: fetchImpl = fetch,
  // Disk-first is the reliable path: googlevideo progressive URLs are
  // pot/IP-bound and Node fetch often gets 403 even when yt-dlp works.
  // 'auto' tries proxy once, then stays on yt-dlp after a hard failure.
  mode = process.env.STREAM_MODE || 'auto',
  cacheDir = path.join(os.tmpdir(), 'pouya-music-cache'),
  log = console
}) {
  // Once fetch has proven it can't reach the CDN (or only serves HLS), stop
  // retrying it every play.
  let fetchIsUsable = mode !== 'ytdlp';
  const inFlight = new Map();

  async function pruneCache() {
    try {
      const names = await fs.readdir(cacheDir);
      if (names.length <= MAX_CACHE_FILES) return;
      const stats = await Promise.all(
        names.map(async (name) => {
          const file = path.join(cacheDir, name);
          return { file, mtime: (await fs.stat(file)).mtimeMs };
        })
      );
      stats.sort((a, b) => a.mtime - b.mtime);
      for (const { file } of stats.slice(0, stats.length - MAX_CACHE_FILES)) {
        await fs.rm(file, { force: true });
      }
    } catch {
      /* cache pruning is best-effort */
    }
  }

  /** Downloads via yt-dlp, deduplicating concurrent requests for one track. */
  async function cachedFile(videoId) {
    await fs.mkdir(cacheDir, { recursive: true });

    const existing = (await fs.readdir(cacheDir)).find(
      (name) => name.startsWith(`${videoId}.`) && !name.endsWith('.part')
    );
    if (existing) return path.join(cacheDir, existing);

    if (!inFlight.has(videoId)) {
      const job = download(videoId, cacheDir)
        .finally(() => inFlight.delete(videoId));
      inFlight.set(videoId, job);
      job.then(pruneCache, () => {});
    }
    return inFlight.get(videoId);
  }

  /** Strategy 2: serve the cached file. Express handles Range and 304s. */
  async function serveFromDisk(req, res, videoId) {
    const file = await cachedFile(videoId);
    const mime = MIME_BY_EXT[path.extname(file).toLowerCase()] ?? 'audio/webm';

    const headers = { 'Content-Type': mime, 'Accept-Ranges': 'bytes' };
    if (req.query.download) {
      headers['Content-Disposition'] = `attachment; filename="${path.basename(file)}"`;
    }

    return new Promise((resolve, reject) => {
      res.sendFile(file, { headers, acceptRanges: true }, (error) =>
        error && !res.headersSent ? reject(error) : resolve()
      );
    });
  }

  /** Strategy 1: stream the CDN url straight through. */
  async function serveViaFetch(req, res, videoId) {
    const resolved = await resolveStream(videoId);

    const url = resolved?.url ?? '';
    if (
      resolved?.mimeType === 'application/x-mpegURL' ||
      urlLooksLikeHls(url)
    ) {
      const err = new Error('resolved stream is HLS — not playable via HTMLAudio');
      err.code = 'HLS_UNPLAYABLE';
      throw err;
    }

    const controller = new AbortController();
    res.on('close', () => controller.abort());
    const clientRange = req.headers.range;

    const upstream = await fetchImpl(resolved.url, {
      headers: { 'user-agent': UA, range: clientRange ?? 'bytes=0-' },
      signal: controller.signal
    });

    // 401/403 are pot/IP-bound CDN rejections — proxy will never work for
    // this session, so switch permanently to the yt-dlp disk path.
    if (upstream.status === 401 || upstream.status === 403) {
      const err = new Error(`upstream returned ${upstream.status}`);
      err.code = 'CDN_FORBIDDEN';
      throw err;
    }
    if (!upstream.ok && upstream.status !== 206) {
      throw new Error(`upstream returned ${upstream.status}`);
    }

    // Some googlevideo URLs return an m3u8 playlist with a 206. HTMLAudio
    // cannot play that — abort before we pipe garbage into <audio>.
    const upstreamType = upstream.headers.get('content-type') || '';
    if (contentTypeIsHls(upstreamType)) {
      try {
        await upstream.body?.cancel();
      } catch {
        /* ignore */
      }
      const err = new Error('upstream served HLS playlist');
      err.code = 'HLS_UNPLAYABLE';
      throw err;
    }

    res.setHeader(
      'Content-Type',
      upstream.headers.get('content-type') || resolved.mimeType || 'audio/webm'
    );
    res.setHeader('Accept-Ranges', 'bytes');

    const contentRange = upstream.headers.get('content-range');
    const upstreamLength = upstream.headers.get('content-length');

    if (clientRange) {
      res.status(upstream.status);
      if (contentRange) res.setHeader('Content-Range', contentRange);
      if (upstreamLength) res.setHeader('Content-Length', upstreamLength);
    } else {
      // Answering 206 to a request without a Range header is invalid HTTP and
      // breaks playback in some browsers.
      res.status(200);
      const total = /\/(\d+)$/.exec(contentRange ?? '')?.[1] ?? upstreamLength;
      if (total) res.setHeader('Content-Length', total);
    }

    if (req.query.download) {
      res.setHeader('Content-Disposition', `attachment; filename="${videoId}.webm"`);
    }

    if (!upstream.body) return res.end();

    await new Promise((resolve, reject) => {
      const stream = Readable.fromWeb(upstream.body);
      stream.on('error', reject);
      res.on('finish', resolve);
      res.on('close', resolve);
      stream.pipe(res);
    });
  }

  return {
    get strategy() {
      if (mode !== 'auto') return mode;
      return fetchIsUsable ? 'proxy' : 'ytdlp';
    },

    async serve(req, res, videoId) {
      const canFallBack = typeof download === 'function' && mode !== 'proxy';

      if (fetchIsUsable && mode !== 'ytdlp') {
        try {
          return await serveViaFetch(req, res, videoId);
        } catch (error) {
          if (res.headersSent) return; // already streaming; nothing to salvage
          if (!canFallBack) throw error;

          // A network-level failure means fetch can't reach YouTube at all, so
          // don't keep paying the timeout on every future track.
          if (/fetch failed|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|socket hang up/i.test(error.message)) {
            fetchIsUsable = false;
            log.error(
              `[audio] fetch cannot reach YouTube (${error.message}) — switching to yt-dlp for the rest of this session`
            );
          } else if (error.code === 'CDN_FORBIDDEN') {
            fetchIsUsable = false;
            log.error(
              `[audio] googlevideo rejected the proxy fetch (403/401) — switching to yt-dlp disk cache`
            );
          } else if (error.code === 'HLS_UNPLAYABLE') {
            log.error(`[audio] ${videoId} resolved to HLS — serving via yt-dlp disk cache`);
          } else {
            log.error(`[audio] direct stream failed (${error.message}) — trying yt-dlp`);
          }
        }
      }

      if (!canFallBack) {
        throw new Error('yt-dlp is not available and direct stream failed');
      }
      return await serveFromDisk(req, res, videoId);
    },

    /** Absolute path of the on-disk track (downloads if needed). */
    async ensureCachedFile(videoId) {
      return cachedFile(videoId);
    },

    /** Clears the on-disk cache. */
    async clearCache() {
      await fs.rm(cacheDir, { recursive: true, force: true });
    },

    cacheDir,
    get cacheExists() {
      return fsSync.existsSync(cacheDir);
    }
  };
}
