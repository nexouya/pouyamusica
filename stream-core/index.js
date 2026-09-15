/**
 * ==========================================================
 * 🎵 HASTE STRIM (هسته استریم یوتیوب - ماژول پرسرعت و مستقل)
 * ==========================================================
 * Complete, standalone YouTube Music streaming engine for Node.js.
 * 
 * Features:
 *  - Multi-tier Provider Engine: InnerTube (youtubei.js) -> yt-dlp -> Invidious -> iTunes Fallback
 *  - Byte-Range Audio Streaming: Seekable, low-latency audio pipes
 *  - Auto Network Proxy: Detects system proxies, V2Ray, Clash, SOCKS5, HTTP(S) for restricted regions
 *  - Auto Browser Cookies: Extracts cookies from Chrome/Edge/Brave/Firefox to bypass bot checks
 *  - High-Speed Audio Downloader: Clean Content-Disposition headers with sanitized song titles
 *  - Built-in Lightweight Web Player UI: For instant testing and browsing in any browser
 * 
 * Usage in another Express project:
 *  ```js
 *  import express from 'express';
 *  import { createYouTubeStreamer } from './haste strim/index.js';
 * 
 *  const app = express();
 *  const ytRouter = await createYouTubeStreamer();
 *  app.use('/yt', ytRouter);
 *  app.listen(3000);
 *  ```
 */

import express from 'express';
import cors from 'cors';
import { createApp } from './app.js';
import { search, resolveStream, status } from './providers/index.js';
import * as ytdlp from './providers/ytdlp.js';
import * as innertube from './providers/innertube.js';
import { createInvidious } from './providers/invidious.js';
import { installProxy, detectProxy } from './net.js';
import { createAudioStreamer } from './audio.js';
import { getAvailableBrowsers, getPrimaryBrowser } from './browserCookies.js';

/**
 * Initializes and returns a ready-to-mount Express router with all routes configured.
 * 
 * @param {Object} [options]
 * @param {string} [options.mode] 'auto' | 'proxy' | 'ytdlp' (default: 'auto')
 * @param {boolean} [options.installSystemProxy] automatically detect and install system proxy (default: true)
 * @returns {Promise<express.Router>}
 */
export async function createYouTubeStreamer(options = {}) {
  const { installSystemProxy = true, mode = process.env.STREAM_MODE || 'auto' } = options;

  if (installSystemProxy) {
    try {
      const proxy = await installProxy();
      if (proxy) {
        console.log(`[haste-strim] → Proxy installed: ${proxy.url} (${proxy.source})`);
      }
    } catch (e) {
      console.warn(`[haste-strim] Proxy installation warning:`, e.message);
    }
  }

  let ytdlpDownload = undefined;
  try {
    const ytdlpInfo = await ytdlp.describe();
    if (ytdlpInfo) {
      console.log(`[haste-strim] → yt-dlp available: ${ytdlpInfo.version}`);
      ytdlpDownload = ytdlp.download;
    }
  } catch (e) {
    // yt-dlp not available, will use innertube / invidious
  }

  const router = createApp({
    search,
    resolveStream,
    status,
    download: ytdlpDownload,
    mode
  });

  return router;
}

/**
 * Creates a complete, standalone Express application with CORS, JSON body parser,
 * and built-in web player test interface mounted on root.
 */
export async function createStandaloneApp(options = {}) {
  const app = express();
  app.use(
    cors({
      origin: true,
      methods: ['GET', 'HEAD', 'OPTIONS'],
      exposedHeaders: ['Content-Length', 'Content-Range', 'Accept-Ranges', 'Content-Disposition'],
    })
  );
  app.use(express.json());

  const ytRouter = await createYouTubeStreamer(options);

  // Mount streaming router on both root and /yt for versatility
  app.use('/yt', ytRouter);
  app.use('/', ytRouter);

  return app;
}

// Exports
export {
  createApp,
  search,
  resolveStream,
  status,
  ytdlp,
  innertube,
  createInvidious,
  installProxy,
  detectProxy,
  createAudioStreamer,
  getAvailableBrowsers,
  getPrimaryBrowser
};

export default createYouTubeStreamer;
