import express from 'express';
import path from 'node:path';
import fsSync from 'node:fs';
import fsPromises from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createAudioStreamer } from './audio.js';
import { prefetchStream } from './providers/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

// Cache for video metadata
const videoMetaCache = new Map();

/**
 * NEVER fall back to iTunes 30-second previews.
 * Full-length YouTube audio only (proxy CDN or yt-dlp disk cache).
 */
export function createApp({ search, resolveStream, download, status, fetch: fetchImpl = fetch, ...options }) {
  const app = express.Router();

  const audio = createAudioStreamer({
    resolveStream,
    download,
    fetch: fetchImpl,
    ...options
  });

  app.get('/healthz', (_req, res) => res.json({ ok: true, strategy: audio.strategy }));

  app.get('/api/cookie-status', async (_req, res) => {
    const userFile = path.join(__dirname, 'cookies-user.txt');
    // 1) Imported user cookies always win — do not probe Chrome if present.
    try {
      if (fsSync.existsSync(userFile)) {
        const text = fsSync.readFileSync(userFile, 'utf8');
        const signedIn = /(^|\t)(SID|HSID|__Secure-1PSID|__Secure-3PSID)\t/m.test(text);
        return res.json({
          ok: true,
          signedIn,
          source: 'cookies-user.txt',
          bytes: Buffer.byteLength(text),
          hint: signedIn
            ? 'Signed-in cookies loaded from cookies-user.txt'
            : 'cookies-user.txt has no SID — re-export from Chrome',
        });
      }
    } catch {
      /* fall through */
    }
    // 2) Best-effort Chrome extract (may fail if Chrome is locked).
    try {
      const { writeCookiesFile } = await import('./chromeCookies.mjs');
      const dest = path.join(__dirname, 'cookies-live.txt');
      const info = writeCookiesFile(dest);
      const text = fsSync.readFileSync(dest, 'utf8');
      const signedIn = /(^|\t)(SID|__Secure-1PSID|__Secure-3PSID)\t/m.test(text);
      res.json({
        ok: true,
        signedIn,
        source: 'chrome',
        bytes: info.bytes,
        hint: signedIn
          ? 'Signed-in Chrome cookies ready'
          : 'Open Chrome, sign into youtube.com (Default profile), then retry',
      });
    } catch (e) {
      res.json({
        ok: false,
        signedIn: false,
        source: 'none',
        error: e.message,
        hint: 'Import cookies: Online → Import cookies (JSON from EditThisCookie / Get cookies.txt LOCALLY)',
      });
    }
  });

  // Import cookies from extension JSON (POST body).
  app.post('/api/import-cookies', express.json({ limit: '2mb' }), async (req, res) => {
    try {
      const list = Array.isArray(req.body) ? req.body : req.body?.cookies;
      if (!Array.isArray(list) || !list.length) {
        return res.status(400).json({ ok: false, error: 'expected cookie array' });
      }
      const { toNetscape } = await import('./import-cookie-json.mjs');
      const text = toNetscape(list);
      const dest = path.join(__dirname, 'cookies-user.txt');
      fsSync.writeFileSync(dest, text, 'utf8');
      const signedIn = /(^|\t)(SID|HSID|__Secure-1PSID|__Secure-3PSID)\t/m.test(text);
      res.json({ ok: true, signedIn, bytes: Buffer.byteLength(text), dest });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/status', (_req, res) =>
    res.json({
      ok: true,
      strategy: audio.strategy,
      engines: typeof status === 'function' ? status() : []
    })
  );

  app.get('/api/search', async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 200) : '';
    if (!q) return res.status(400).json({ error: 'query parameter q is required' });
    const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 40);

    try {
      const songs = await search(q, limit);
      if (Array.isArray(songs)) {
        for (const s of songs) {
          if (s.videoId && s.title) {
            videoMetaCache.set(s.videoId, `${s.artist || ''} ${s.title}`.trim());
          }
        }
      }
      res.json({ query: q, songs });
      // Warm only the first hit so Play is near-instant without hammering YT.
      if (songs?.[0]?.videoId) prefetchStream(songs[0].videoId);
    } catch (error) {
      res.status(502).json({ error: error.message });
    }
  });

  // Direct redirect to the CDN url.
  app.get('/stream/:videoId', async (req, res) => {
    const { videoId } = req.params;
    if (!VIDEO_ID.test(videoId)) return res.status(400).type('text').send('invalid video id');

    try {
      const { url } = await resolveStream(videoId);
      res.redirect(302, url);
    } catch (error) {
      console.error(`stream ${videoId} failed:`, error.message);
      res.status(502).type('text').send(`could not resolve audio: ${error.message}`);
    }
  });

  // Full-length YouTube audio only — no 30s preview fallbacks.
  app.get('/play/:videoId', async (req, res) => {
    const { videoId } = req.params;
    if (!VIDEO_ID.test(videoId)) return res.status(400).type('text').send('invalid video id');

    try {
      await audio.serve(req, res, videoId);
    } catch (error) {
      console.warn(`play ${videoId} failed (${error.message})`);
      if (!res.headersSent) {
        res.status(502).type('text').send(`YouTube stream failed: ${error.message}`);
      } else {
        res.end();
      }
    }
  });

  // Full-file download via yt-dlp / proxy — never previews.
  app.get('/download/:videoId', async (req, res) => {
    const { videoId } = req.params;
    if (!VIDEO_ID.test(videoId)) return res.status(400).type('text').send('invalid video id');

    const trackTitle = (req.query.title ? String(req.query.title) : videoId)
      .replace(/[^\w\s؀-ۿ.-]/gi, '')
      .trim() || videoId;

    req.query.download = '1';

    try {
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(trackTitle)}.m4a"`);
      await audio.serve(req, res, videoId);
    } catch (error) {
      console.warn(`download ${videoId} failed (${error.message})`);
      if (!res.headersSent) {
        res.status(502).type('text').send(`Download failed: ${error.message}`);
      } else {
        res.end();
      }
    }
  });

  /**
   * Export a local absolute path after yt-dlp has written the track to disk.
   * The desktop app copies the file locally — avoids buffering multi-MB audio
   * through a hand-rolled HTTP client.
   */
  app.get('/api/export/:videoId', async (req, res) => {
    const { videoId } = req.params;
    if (!VIDEO_ID.test(videoId)) {
      return res.status(400).json({ ok: false, error: 'invalid video id' });
    }
    if (typeof audio.ensureCachedFile !== 'function') {
      return res.status(501).json({ ok: false, error: 'yt-dlp export unavailable' });
    }
    try {
      const file = await audio.ensureCachedFile(videoId);
      const st = await fsPromises.stat(file);
      const ext = path.extname(file).toLowerCase();
      const mime =
        ext === '.webm' ? 'audio/webm' : ext === '.mp3' ? 'audio/mpeg' : 'audio/mp4';
      res.json({
        ok: true,
        path: file,
        filename: path.basename(file),
        bytes: st.size,
        mime
      });
    } catch (error) {
      console.error(`export ${videoId} failed:`, error.message);
      res.status(502).json({ ok: false, error: error.message });
    }
  });

  app.locals = { audio };
  return app;
}
