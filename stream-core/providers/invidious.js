/**
 * Third engine: Invidious — public, open-source YouTube frontends with a free
 * JSON API. When both innertube and yt-dlp are dead (blocked network, broken
 * player), these instances often still work because they run in unrestricted
 * regions and can proxy the audio through themselves.
 *
 * Instances come and go, so a list is tried in order and the last one that
 * worked is remembered and tried first next time.
 */

const DEFAULT_INSTANCES = [
  'https://yewtu.be',
  'https://inv.nadeko.net',
  'https://invidious.nerdvpn.de',
  'https://invidious.f5.si',
  'https://iv.melmac.space'
];

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

export function createInvidious({
  instances = process.env.INVIDIOUS_INSTANCES?.split(',').map((entry) => entry.trim()).filter(Boolean) ??
    DEFAULT_INSTANCES,
  fetch: fetchImpl = (...args) => fetch(...args),
  timeoutMs = 12_000,
  // Proxied urls (`local=true`) stream through the instance itself — exactly
  // what is needed when googlevideo is unreachable from here.
  preferProxied = true
} = {}) {
  let preferred = 0; // index of the last instance that worked

  async function getJson(base, path) {
    const response = await fetchImpl(`${base}${path}`, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = await response.json();
    if (body && typeof body === 'object' && 'error' in body) throw new Error(String(body.error));
    return body;
  }

  /** Tries every instance starting from the last known-good one. */
  async function withInstance(fn) {
    const errors = [];
    for (let step = 0; step < instances.length; step++) {
      const index = (preferred + step) % instances.length;
      const base = instances[index].replace(/\/$/, '');
      try {
        const result = await fn(base);
        preferred = index;
        return result;
      } catch (error) {
        errors.push(`${base}: ${error.message}`);
      }
    }
    throw new Error(`all invidious instances failed (${errors.join(' | ')})`);
  }

  function bestThumbnail(item) {
    const thumbnails = item?.videoThumbnails ?? [];
    const best = [...thumbnails].sort((a, b) => (a?.width ?? 0) - (b?.width ?? 0)).pop();
    const url = best?.url;
    if (!url) return null;
    return url.startsWith('http') ? url : null; // relative thumbs need the instance; skip
  }

  async function search(query, limit = 10) {
    return withInstance(async (base) => {
      const results = await getJson(
        base,
        `/api/v1/search?q=${encodeURIComponent(query)}&type=video`
      );
      if (!Array.isArray(results)) throw new Error('unexpected search payload');

      return results
        .filter((item) => item?.type === 'video' && VIDEO_ID.test(item.videoId ?? ''))
        .slice(0, limit)
        .map((item) => ({
          videoId: item.videoId,
          title: item.title ?? 'Untitled',
          artist: item.author ?? '',
          duration: item.lengthSeconds ?? null,
          thumbnail:
            bestThumbnail(item) ?? `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg`
        }));
    });
  }

  function pickAudioFormat(video) {
    const formats = (video.adaptiveFormats ?? []).filter((format) =>
      String(format.type ?? '').startsWith('audio/')
    );
    if (formats.length === 0) return null;

    // AAC first (every browser decodes it), then highest bitrate.
    formats.sort((a, b) => {
      const aMp4 = String(a.type).includes('audio/mp4') ? 1 : 0;
      const bMp4 = String(b.type).includes('audio/mp4') ? 1 : 0;
      if (aMp4 !== bMp4) return bMp4 - aMp4;
      return (Number(b.bitrate) || 0) - (Number(a.bitrate) || 0);
    });
    return formats[0];
  }

  async function resolveStream(videoId) {
    if (!VIDEO_ID.test(videoId)) throw new Error('invalid video id');

    return withInstance(async (base) => {
      const query = preferProxied ? '?local=true' : '';
      const video = await getJson(base, `/api/v1/videos/${videoId}${query}`);

      const format = pickAudioFormat(video);
      if (!format?.url) throw new Error('no audio format in response');

      // With local=true some instances return relative /videoplayback urls.
      const url = new URL(format.url, base).toString();
      const mimeType = String(format.type).split(';')[0].trim() || 'audio/mp4';

      return { url, mimeType, contentLength: format.clen ?? null, via: `invidious:${base}` };
    });
  }

  return { name: 'invidious', search, resolveStream };
}
