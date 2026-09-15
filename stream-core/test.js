/**
 * ==========================================================
 * 🧪 HASTE STRIM - QUICK VERIFICATION SCRIPT
 * ==========================================================
 * Run directly via:
 *   node test.js
 */

import { search, resolveStream, status, ytdlp, detectProxy } from './index.js';

async function runTest() {
  console.log('----------------------------------------------------');
  console.log('🧪 Testing YouTube Streaming Core (haste strim)...');
  console.log('----------------------------------------------------');

  // 1. Check Proxy
  console.log('\n[1/4] Checking Network & Proxy detection:');
  try {
    const proxy = await detectProxy();
    console.log(proxy ? `  ✅ Proxy detected: ${proxy.url} (${proxy.source})` : '  ℹ️ No proxy configured (direct connection)');
  } catch (e) {
    console.log('  ⚠️ Proxy detection notice:', e.message);
  }

  // 2. Check yt-dlp binary
  console.log('\n[2/4] Checking yt-dlp binary:');
  try {
    const info = await ytdlp.describe();
    if (info) {
      console.log(`  ✅ Found yt-dlp version: ${info.version} (via ${info.command})`);
    } else {
      console.log('  ℹ️ yt-dlp not found locally, engine will use InnerTube/Invidious directly');
    }
  } catch (e) {
    console.log('  ⚠️ yt-dlp notice:', e.message);
  }

  // 3. Test Search
  const query = 'Adele Skyfall';
  console.log(`\n[3/4] Testing Search for "${query}":`);
  let foundSong = null;
  try {
    const t0 = Date.now();
    const songs = await search(query, 3);
    const elapsed = Date.now() - t0;
    console.log(`  ✅ Search succeeded in ${elapsed}ms (${songs.length} results returned):`);
    songs.forEach((s, idx) => {
      console.log(`     ${idx + 1}. [${s.videoId}] ${s.title} - ${s.artist} (${s.duration || '?'}s)`);
    });
    foundSong = songs[0];
  } catch (e) {
    console.error('  ❌ Search failed:', e.message);
  }

  // 4. Test Stream Resolution
  if (foundSong && foundSong.videoId) {
    console.log(`\n[4/4] Testing Audio Stream Resolution for [${foundSong.videoId}]:`);
    try {
      const t0 = Date.now();
      const streamInfo = await resolveStream(foundSong.videoId);
      const elapsed = Date.now() - t0;
      console.log(`  ✅ Stream resolved in ${elapsed}ms:`);
      console.log(`     • Format / MIME : ${streamInfo.mimeType || 'audio/mp4'}`);
      console.log(`     • Resolved Via  : ${streamInfo.via || 'unknown'}`);
      console.log(`     • Audio URL     : ${streamInfo.url.slice(0, 75)}...`);
    } catch (e) {
      console.error('  ❌ Stream resolution failed:', e.message);
    }
  }

  // 5. Engine Status
  console.log('\n📊 Engine Health Status:');
  console.log(status());

  console.log('\n----------------------------------------------------');
  console.log('🎉 Verification process finished!');
  console.log('----------------------------------------------------');
}

runTest().catch((err) => {
  console.error('Test run crashed:', err);
});
