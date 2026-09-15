async function main() {
  const tSearch = Date.now();
  const s = await fetch('http://127.0.0.1:17321/api/search?q=Shape+of+You&limit=5').then((r) => r.json());
  const searchMs = Date.now() - tSearch;
  const song = s.songs.find((x) => /^[A-Za-z0-9_-]{11}$/.test(x.videoId || ''));
  console.log('search', searchMs + 'ms', song?.title);

  // Prefetch window
  await new Promise((r) => setTimeout(r, 5500));

  const t0 = Date.now();
  const r = await fetch('http://127.0.0.1:17321/play/' + song.videoId, {
    headers: { Range: 'bytes=0-4095' },
  });
  const buf = await r.arrayBuffer();
  const playMs = Date.now() - t0;
  console.log('play', playMs + 'ms', 'status', r.status, 'bytes', buf.byteLength, r.headers.get('content-range'));
  console.log(playMs < 3000 ? 'PASS <3s' : 'FAIL slow');

  // Second play (cache)
  const t1 = Date.now();
  const r2 = await fetch('http://127.0.0.1:17321/play/' + song.videoId, {
    headers: { Range: 'bytes=0-4095' },
  });
  await r2.arrayBuffer();
  console.log('replay', Date.now() - t1 + 'ms');
}
main().catch(console.error);
