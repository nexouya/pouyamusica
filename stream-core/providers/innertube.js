/**
 * Provider backed by youtubei.js — the Node equivalent of ytmusicapi.
 * Handles both search (YouTube Music) and audio stream resolution.
 */
import { Innertube, UniversalCache } from 'youtubei.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const moduleRoot = path.resolve(__dirname, '..');

let sessionPromise = null;

function getYouTubeCookie() {
  if (process.env.YOUTUBE_COOKIES) {
    return process.env.YOUTUBE_COOKIES.trim();
  }
  const cookieCandidates = [
    process.env.COOKIES_FILE,
    path.resolve(moduleRoot, 'cookies.txt'),
    path.resolve(process.cwd(), 'cookies.txt'),
    path.resolve(process.cwd(), 'haste strim', 'cookies.txt')
  ].filter(Boolean);
  const cookiePath = cookieCandidates.find(p => fs.existsSync(p));
  try {
    if (cookiePath && fs.existsSync(cookiePath)) {
      const raw = fs.readFileSync(cookiePath, 'utf8').trim();
      // If it's a Netscape cookie file, parse into standard Cookie header format
      if (raw.includes('\t')) {
        const lines = raw.split('\n').filter(l => l && !l.startsWith('#'));
        const pairs = [];
        for (const line of lines) {
          const parts = line.split('\t');
          if (parts.length >= 7 && (parts[0].includes('youtube.com') || parts[0].includes('google.com'))) {
            pairs.push(parts[5] + '=' + parts[6].trim());
          }
        }
        if (pairs.length > 0) return pairs.join('; ');
      }
      return raw;
    }
  } catch (e) {
    // Ignore file read error
  }
  return undefined;
}

async function getSession() {
  if (!sessionPromise) {
    const cookie = getYouTubeCookie();
    sessionPromise = Innertube.create({
      cache: new UniversalCache(false),
      generate_session_locally: true,
      retrieve_player: true,
      ...(cookie ? { cookie } : {})
    }).catch((error) => {
      sessionPromise = null; // allow a retry on the next request
      throw error;
    });
  }
  return sessionPromise;
}

function upgradeCoverResolution(url, videoId) {
  if (!url && videoId) {
    return `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
  }
  if (!url) return null;
  // If thumbnail is on Google User Content (lh3/yt3), request full 1200px master
  if (url.includes('googleusercontent.com')) {
    return url
      .replace(/=w\d+-h\d+[^?&]*/, '=w1200-h1200-l90-rj')
      .replace(/=s\d+[^?&]*/, '=s1200');
  }
  // If thumbnail is standard YouTube image CDN, upgrade to maxresdefault.jpg
  if (url.includes('i.ytimg.com') || url.includes('img.youtube.com')) {
    return url.replace(/(hqdefault|mqdefault|sddefault|default)\.jpg/, 'maxresdefault.jpg');
  }
  return url;
}

function bestThumbnail(item, videoId) {
  const thumbnails = item?.thumbnails ?? item?.thumbnail?.contents ?? [];
  const largest = [...thumbnails].sort((a, b) => (a?.width ?? 0) - (b?.width ?? 0)).pop();
  const rawUrl = largest?.url ?? (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : null);
  return upgradeCoverResolution(rawUrl, videoId);
}

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const PLAYABLE = new Set(['song', 'video', 'non_music_track']);

/** MusicResponsiveListItem — the normal row in a search shelf. */
function fromListItem(item) {
  // Albums, playlists and artists also expose an `id`, but it's a browseId
  // (MPREb…, UC…, VL…) rather than something /play can stream.
  if (typeof item?.id !== 'string' || !VIDEO_ID.test(item.id)) return null;
  if (item.item_type && !PLAYABLE.has(item.item_type)) return null;

  const people = item.artists ?? item.authors ?? (item.author ? [item.author] : []);
  return {
    videoId: item.id,
    title: (typeof item.title === 'string' ? item.title : item.title?.text) || 'Untitled',
    artist: people.map((person) => person?.name).filter(Boolean).join(', '),
    duration: item.duration?.seconds ?? null,
    thumbnail: bestThumbnail(item, item.id)
  };
}

/** MusicCardShelf — the "top result" card, which carries its id on on_tap. */
function fromCardShelf(shelf) {
  const videoId = shelf?.on_tap?.payload?.videoId;
  if (typeof videoId !== 'string' || !VIDEO_ID.test(videoId)) return null;

  return {
    videoId,
    title: shelf.title?.text || 'Untitled',
    artist: (shelf.subtitle?.text || '').split(' • ').filter(Boolean)[1] ?? shelf.subtitle?.text ?? '',
    duration: null,
    thumbnail: bestThumbnail(shelf, videoId)
  };
}

/** Walk the shelves the API returns and normalise every playable item. */
export function collectSongs(searchResult) {
  const shelves = [searchResult?.songs, searchResult?.videos, ...(searchResult?.contents ?? [])]
    .filter(Boolean);

  const songs = [];
  for (const shelf of shelves) {
    const top = fromCardShelf(shelf);
    if (top) songs.push(top);

    for (const item of shelf?.contents ?? []) {
      const song = fromListItem(item);
      if (song) songs.push(song);
    }
  }
  return songs;
}

export async function search(query, limit = 10) {
  const yt = await getSession();
  const result = await yt.music.search(query, { type: 'song' });

  const seen = new Set();
  const songs = [];
  for (const song of collectSongs(result)) {
    if (seen.has(song.videoId)) continue;
    seen.add(song.videoId);
    songs.push(song);
    if (songs.length >= limit) break;
  }
  return songs;
}

// The WEB client sometimes serves formats that need a cipher the browser can't
// replay, so fall back through clients that hand back plain URLs.
const CLIENTS = ['YTMUSIC', 'IOS', 'ANDROID', 'WEB'];

export async function resolveStream(videoId) {
  const yt = await getSession();
  const errors = [];

  for (const client of CLIENTS) {
    try {
      const format = await yt.getStreamingData(videoId, {
        type: 'audio',
        quality: 'best',
        client
      });
      if (format?.url) {
        return {
          url: format.url,
          mimeType: format.mime_type ?? 'audio/webm',
          contentLength: format.content_length ?? null,
          via: `innertube:${client}`
        };
      }
      errors.push(`${client}: no url in format`);
    } catch (error) {
      errors.push(`${client}: ${error.message}`);
    }
  }

  throw new Error(`no playable audio format (${errors.join(' | ')})`);
}

export const name = 'innertube';
