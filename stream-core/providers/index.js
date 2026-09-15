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

export function search(query, limit = 10) {
  return chain.search(query, limit);
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
