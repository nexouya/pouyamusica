/**
 * ==========================================================
 * 🚀 HASTE STRIM STANDALONE SERVER
 * ==========================================================
 * Run directly via:
 *   node server.js
 * Or:
 *   npm start
 */

import { createStandaloneApp } from './index.js';

const PORT = Number(process.env.PORT) || 4000;
const HOST = process.env.HOST || '0.0.0.0';

async function start() {
  console.log('----------------------------------------------------');
  console.log('🎵 Initializing YouTube Streaming Core (haste strim)...');
  console.log('----------------------------------------------------');

  try {
    const app = await createStandaloneApp();

    const server = app.listen(PORT, HOST, () => {
      console.log('');
      console.log(`✅ Haste Strim Server is LIVE at: http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
      console.log('');
      console.log('📌 Available Endpoints:');
      console.log(`  • Web Player UI : http://localhost:${PORT}/?q=Shadmehr`);
      console.log(`  • Search API    : http://localhost:${PORT}/api/search?q=Michael+Jackson`);
      console.log(`  • Stream Audio  : http://localhost:${PORT}/play/<videoId>`);
      console.log(`  • Direct 302    : http://localhost:${PORT}/stream/<videoId>`);
      console.log(`  • Download MP3  : http://localhost:${PORT}/download/<videoId>?title=MySong`);
      console.log(`  • Engine Status : http://localhost:${PORT}/api/status`);
      console.log(`  • Health Check  : http://localhost:${PORT}/healthz`);
      console.log('');
      console.log('💡 Press Ctrl+C to terminate the server.');
      console.log('----------------------------------------------------');
    });

    const shutdown = () => {
      console.log('\n🛑 Shutting down Haste Strim Server...');
      server.close(() => {
        console.log('👋 Server gracefully closed.');
        process.exit(0);
      });
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (err) {
    console.error('❌ Failed to start Haste Strim Server:', err);
    process.exit(1);
  }
}

start();
