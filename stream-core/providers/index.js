/**
 * Wires the three engines into a health-tracked chain:
 *
 *   1. innertube (youtubei.js) — fastest when it works
 *   2. yt-dlp                  — most reliable; own network stack
 *   3. invidious               — public instances; last resort when the local
 *                                network can't reach YouTube at all
 *
 * ENGINE=innertube|ytdlp|invidious pins a single engine.
 */
import * as innertube from './innertube.js';
import * as ytdlp from './ytdlp.js';
import { createInvidious } from './invidious.js';
import { createChain } from './chain.js';

const ENGINE = (process.env.ENGINE || 'auto').toLowerCase();
const invidious = createInvidious();

function selectedProviders() {
  if (ENGINE === 'innertube') return [innertube];
  if (ENGINE === 'ytdlp') return [ytdlp];
  if (ENGINE === 'invidious') return [invidious];
  return [innertube, ytdlp, invidious];
}

const chain = createChain({ providers: selectedProviders() });

function dedupePush(target, seen, items) {
  for (const s of items || []) {
    if (!s?.videoId || !s?.title) continue;
    if (seen.has(s.videoId)) continue;
    seen.add(s.videoId);
    target.push(s);
  }
}

/**
 * Strong multi-lane search: yt-dlp + innertube + query variants in parallel.
 * yt-dlp lanes merge first (correct durations); other engines only top-up.
 */
export async function search(query, limit = 25) {
  const cap = Math.min(Math.max(Number(limit) || 25, 1), 40);
  const seen = new Set();
  const songs = [];

  const ytdlpLanes = [];
  if (ENGINE !== 'innertube' && ENGINE !== 'invidious') {
    ytdlpLanes.push(() => ytdlp.search(query, cap));
    ytdlpLanes.push(() => ytdlp.search(`${query} official audio`, Math.min(12, cap)));
    ytdlpLanes.push(() => ytdlp.search(`${query} music video`, Math.min(8, cap)));
  }

  const otherLanes = [];
  if (ENGINE !== 'ytdlp' && ENGINE !== 'invidious') {
    otherLanes.push(() => innertube.search(query, cap));
  }
  if (ENGINE !== 'ytdlp' && ENGINE !== 'innertube') {
    otherLanes.push(() => invidious.search(query, Math.min(10, cap)));
  }

  const runAll = async (lanes) =>
    Promise.allSettled(
      lanes.map(async (run) => {
        try {
          return await run();
        } catch {
          return [];
        }
      })
    );

  // Fire every lane at once so nothing waits, but merge in priority order.
  const [ytOut, otherOut] = await Promise.all([runAll(ytdlpLanes), runAll(otherLanes)]);

  for (const r of ytOut) {
    if (r.status === 'fulfilled') dedupePush(songs, seen, r.value);
  }
  for (const r of otherOut) {
    if (r.status === 'fulfilled') dedupePush(songs, seen, r.value);
  }

  // If still thin, try the health-tracked chain as a safety net.
  if (songs.length < Math.min(4, cap)) {
    try {
      dedupePush(songs, seen, await chain.search(query, cap));
    } catch {
      /* ignore */
    }
  }

  return songs.slice(0, cap);
}

export function status() {
  return chain.status();
}

// Stream URLs stay valid for hours but are tied to the requesting IP, so a
// short cache keeps repeated <audio> range requests from re-resolving.
const cache = new Map();
const TTL_MS = 25 * 60 * 1000;

const inflight = new Map();

export async function resolveStream(videoId) {
  const hit = cache.get(videoId);
  if (hit && hit.expires > Date.now()) return hit.value;

  // Deduplicate concurrent resolves for the same id.
  if (inflight.has(videoId)) return inflight.get(videoId);

  const job = (async () => {
    const value = await chain.resolveStream(videoId);
    // HLS playlists are not playable in HTMLAudio — don't cache them long.
    const hls =
      value?.mimeType === 'application/x-mpegURL' ||
      String(value?.url || '').includes('.m3u8') ||
      String(value?.url || '').includes('/manifest/hls');
    cache.set(videoId, { value, expires: Date.now() + (hls ? 30_000 : TTL_MS) });
    inflight.delete(videoId);
    if (cache.size > 500) {
      for (const [key, entry] of cache) {
        if (entry.expires <= Date.now()) cache.delete(key);
      }
    }
    return value;
  })().catch((e) => {
    inflight.delete(videoId);
    throw e;
  });

  inflight.set(videoId, job);
  return job;
}

/** Warm the stream-URL cache in the background (does not throw). */
export function prefetchStream(videoId) {
  if (!videoId) return;
  resolveStream(videoId).catch(() => {});
}
