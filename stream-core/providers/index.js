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
 * Strong search: merge YouTube Music + yt-dlp web search so results are deep
 * and not limited to one shelf type.
 */
export async function search(query, limit = 25) {
  const cap = Math.min(Math.max(Number(limit) || 25, 1), 40);
  const seen = new Set();
  const songs = [];

  // Primary: provider chain (music-first).
  try {
    dedupePush(songs, seen, await chain.search(query, cap));
  } catch (e) {
    /* continue with fallbacks */
  }

  // Secondary: direct yt-dlp web search for depth / official uploads.
  if (songs.length < cap && ENGINE !== 'innertube') {
    const remaining = cap - songs.length;
    try {
      const extra = await ytdlp.search(query, remaining + 8);
      dedupePush(songs, seen, extra);
    } catch (e) {
      /* ignore */
    }
  }

  // Tertiary: yt-dlp with "official audio" bias if still thin.
  if (songs.length < Math.min(8, cap) && ENGINE !== 'innertube') {
    try {
      const extra = await ytdlp.search(`${query} official audio`, cap);
      dedupePush(songs, seen, extra);
    } catch (e) {
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
const TTL_MS = 5 * 60 * 1000;

export async function resolveStream(videoId) {
  const hit = cache.get(videoId);
  if (hit && hit.expires > Date.now()) return hit.value;

  const value = await chain.resolveStream(videoId);
  cache.set(videoId, { value, expires: Date.now() + TTL_MS });

  if (cache.size > 500) {
    for (const [key, entry] of cache) {
      if (entry.expires <= Date.now()) cache.delete(key);
    }
  }
  return value;
}
