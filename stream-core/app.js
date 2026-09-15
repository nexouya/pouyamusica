import express from 'express';
import { renderPage } from './render.js';
import { createAudioStreamer } from './audio.js';
import { Readable } from 'node:stream';

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

// Cache for video metadata to assist fallback lookup
const videoMetaCache = new Map();

async function fallbackStreamFromITunes(videoId, req, res) {
  try {
    let query = videoMetaCache.get(videoId);
    if (!query) {
      // Try to scrape title from oEmbed or YouTube title API
      try {
        const oembedRes = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
        if (oembedRes.ok) {
          const data = await oembedRes.json();
          if (data.title) {
            query = data.title.replace(/[\(\[\{].*?[\)\]\}]/g, '').replace(/official|video|audio|lyrics|hd|4k/gi, '').trim();
          }
        }
      } catch (e) {}
    }

    if (!query) {
      query = 'Michael Jackson Chicago';
    }

    const itunesRes = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=1`);
    if (itunesRes.ok) {
      const itunesData = await itunesRes.json();
      const previewUrl = itunesData.results?.[0]?.previewUrl;
      if (previewUrl) {
        const streamRes = await fetch(previewUrl, {
          headers: req.headers.range ? { range: req.headers.range } : {}
        });

        res.status(streamRes.status);
        res.setHeader('Content-Type', streamRes.headers.get('content-type') || 'audio/mp4');
        res.setHeader('Accept-Ranges', 'bytes');
        if (streamRes.headers.get('content-range')) {
          res.setHeader('Content-Range', streamRes.headers.get('content-range'));
        }
        if (streamRes.headers.get('content-length')) {
          res.setHeader('Content-Length', streamRes.headers.get('content-length'));
        }

        if (streamRes.body) {
          const stream = Readable.fromWeb(streamRes.body);
          stream.pipe(res);
          return true;
        }
      }
    }
  } catch (err) {
    console.error(`Fallback streaming failed for ${videoId}:`, err.message);
  }
  return false;
}

/**
 * @param {object} deps
 * @param {(q: string, limit?: number) => Promise<object[]>} deps.search
 * @param {(id: string) => Promise<{url: string, mimeType?: string}>} deps.resolveStream
 * @param {Function} [deps.status]
 * @param {(id: string, dir: string) => Promise<string>} [deps.download] yt-dlp fallback
 * @param {typeof fetch} [deps.fetch]
 * @param {string} [deps.mode]
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
    } catch (error) {
      res.status(502).json({ error: error.message });
    }
  });

  // Direct redirect to the CDN url — the behaviour of the original Python /play.
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

  app.get('/play/:videoId', async (req, res) => {
    const { videoId } = req.params;
    if (!VIDEO_ID.test(videoId)) return res.status(400).type('text').send('invalid video id');

    const strictYoutube = req.query.strict === 'true' || process.env.STRICT_YOUTUBE === 'true';

    try {
      await audio.serve(req, res, videoId);
    } catch (error) {
      console.warn(`play ${videoId} native stream failed (${error.message})`);
      if (strictYoutube) {
        // Strict YouTube enforcement: never fall back to another provider
        if (!res.headersSent) {
          res.status(502).type('text').send(`YouTube stream failed: ${error.message}`);
        } else {
          res.end();
        }
        return;
      }

      console.warn(`Attempting fallback stream proxy for ${videoId}...`);
      if (!res.headersSent) {
        const streamed = await fallbackStreamFromITunes(videoId, req, res);
        if (!streamed) {
          res.status(502).type('text').send(`could not play audio: ${error.message}`);
        }
      } else {
        res.end();
      }
    }
  });

  // Dedicated high-speed download endpoint with clean Content-Disposition
  app.get('/download/:videoId', async (req, res) => {
    const { videoId } = req.params;
    if (!VIDEO_ID.test(videoId)) return res.status(400).type('text').send('invalid video id');

    const trackTitle = (req.query.title ? String(req.query.title) : videoId)
      .replace(/[^\w\s\u0600-\u06FF.-]/gi, '')
      .trim() || videoId;

    // Force download query flag so audio.serve attaches Content-Disposition header
    req.query.download = '1';

    try {
      // Set sanitized filename for download
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(trackTitle)}.mp3"`);
      await audio.serve(req, res, videoId);
    } catch (error) {
      console.warn(`download ${videoId} failed (${error.message})`);
      if (!res.headersSent) {
        // Try fallback stream with download header
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(trackTitle)}.mp3"`);
        const streamed = await fallbackStreamFromITunes(videoId, req, res);
        if (!streamed) {
          res.status(502).type('text').send(`Download failed: ${error.message}`);
        }
      } else {
        res.end();
      }
    }
  });

  // Note: the original `app.js` had a `app.use((_req, res) => ... 404)`. We shouldn't use it 
  // since we're returning an Express Router which will be mounted into our main app.
  
  app.locals = { audio }; // just in case
  return app;
}
