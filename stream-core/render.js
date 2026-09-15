/**
 * HTML rendering. Pure functions, no I/O — so they can be unit tested.
 */

const ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
};

export function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"']/g, (ch) => ESCAPES[ch]);
}

/** Only allow http(s) image URLs into the src attribute. */
function safeImage(url) {
  if (typeof url !== 'string') return '';
  return /^https?:\/\//i.test(url) ? escapeHtml(url) : '';
}

function formatDuration(seconds) {
  const total = Number(seconds);
  if (!Number.isFinite(total) || total <= 0) return '';
  const mins = Math.floor(total / 60);
  const secs = Math.floor(total % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function renderCard(song) {
  const id = escapeHtml(song.videoId);
  const cover = safeImage(song.thumbnail);
  const duration = formatDuration(song.duration);

  return `
      <article class="card">
        ${cover ? `<img class="cover" src="${cover}" alt="" loading="lazy" width="112" height="112">` : '<div class="cover cover--empty" aria-hidden="true">♪</div>'}
        <div class="meta">
          <h2 class="title">${escapeHtml(song.title)}</h2>
          <p class="artist">${escapeHtml(song.artist) || 'Unknown artist'}${duration ? ` <span class="dot">·</span> ${duration}` : ''}</p>
          <audio class="player" controls preload="none" data-video-id="${id}" src="/play/${id}"></audio>
          <p class="status" role="status"></p>
          <p class="row">
            <a class="link" href="/play/${id}?download=1" download>Download audio</a>
            <a class="link" href="https://music.youtube.com/watch?v=${id}" target="_blank" rel="noopener noreferrer">Open on YouTube Music</a>
          </p>
        </div>
      </article>`;
}

export function renderResults({ q, songs, error }) {
  if (error) {
    return `<div class="notice notice--error"><strong>Search failed.</strong> ${escapeHtml(error)}</div>`;
  }
  if (!q) {
    return `<div class="notice">Type a song, artist, or album above to start.</div>`;
  }
  if (!songs || songs.length === 0) {
    return `<div class="notice">No songs matched “${escapeHtml(q)}”. Try a different spelling.</div>`;
  }
  return `<p class="count">${songs.length} result${songs.length === 1 ? '' : 's'} for “${escapeHtml(q)}”</p>` +
    songs.map(renderCard).join('\n');
}

export function renderPage({ q = '', songs = [], error = null } = {}) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${q ? `${escapeHtml(q)} — Pouya Music` : 'Pouya Music'}</title>
<style>
  :root {
    --bg: #111;
    --surface: #222;
    --surface-hover: #2a2a2a;
    --text: #fff;
    --muted: #9a9a9a;
    --accent: #1db954;
    --danger: #ff6b6b;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 30px 20px 60px;
    background: var(--bg);
    color: var(--text);
    font-family: Arial, Helvetica, sans-serif;
    line-height: 1.5;
  }
  .wrap { max-width: 760px; margin: 0 auto; }
  h1 { font-size: 28px; margin: 0 0 20px; letter-spacing: -0.5px; }
  form { display: flex; gap: 10px; }
  input {
    flex: 1;
    min-width: 0;
    padding: 12px 14px;
    border: 0;
    border-radius: 10px;
    background: var(--surface);
    color: var(--text);
    font-size: 16px;
  }
  input::placeholder { color: var(--muted); }
  button {
    padding: 12px 20px;
    border: 0;
    border-radius: 10px;
    background: var(--accent);
    color: #06210f;
    font-size: 16px;
    font-weight: bold;
    cursor: pointer;
  }
  button:hover { filter: brightness(1.1); }
  :focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .count { color: var(--muted); font-size: 14px; margin: 24px 0 4px; }
  .card {
    background: var(--surface);
    padding: 15px;
    margin: 16px 0;
    border-radius: 15px;
    display: flex;
    gap: 16px;
  }
  .cover { width: 112px; height: 112px; border-radius: 10px; object-fit: cover; flex: 0 0 auto; background: #333; }
  .cover--empty { display: grid; place-items: center; font-size: 32px; color: var(--muted); }
  .meta { min-width: 0; flex: 1; }
  .title { font-size: 17px; margin: 0 0 4px; overflow-wrap: anywhere; }
  .artist { margin: 0 0 10px; color: var(--muted); font-size: 14px; overflow-wrap: anywhere; }
  .dot { opacity: 0.6; }
  .player { width: 100%; max-width: 360px; height: 36px; }
  .row { display: flex; flex-wrap: wrap; gap: 14px; margin: 10px 0 0; }
  .status { margin: 8px 0 0; font-size: 13px; color: var(--muted); min-height: 1em; }
  .status--error { color: var(--danger); }
  .status button {
    background: none;
    border: 0;
    padding: 0 0 0 6px;
    color: var(--accent);
    font-size: 13px;
    font-weight: normal;
    text-decoration: underline;
    cursor: pointer;
  }
  .link { color: var(--muted); font-size: 13px; text-decoration: none; border-bottom: 1px solid #444; }
  .link:hover { color: var(--text); }
  .notice {
    background: var(--surface);
    border-radius: 12px;
    padding: 16px;
    margin: 28px 0;
    color: var(--muted);
    font-size: 15px;
  }
  .notice--error { color: var(--danger); }
  .notice--error strong { display: block; margin-bottom: 4px; }
  @media (max-width: 520px) {
    .card { flex-direction: column; }
    .cover { width: 100%; height: 180px; }
  }
</style>
</head>
<body>
<div class="wrap">
  <h1>🎵 Pouya Music</h1>
  <form action="/" method="get" role="search">
    <input name="q" value="${escapeHtml(q)}" placeholder="Search music" autocomplete="off" autofocus aria-label="Search music">
    <button type="submit">Search</button>
  </form>
  ${renderResults({ q, songs, error })}
</div>
<script>
  // Only one track plays at a time.
  document.addEventListener('play', (event) => {
    for (const player of document.querySelectorAll('audio')) {
      if (player !== event.target) player.pause();
    }
  }, true);

  // Playback can be slow on the first play of a track, and a silent dead
  // player is the worst possible feedback. Say what is happening.
  for (const card of document.querySelectorAll('.card')) {
    const player = card.querySelector('audio');
    const status = card.querySelector('.status');
    if (!player || !status) continue;

    const say = (text, isError) => {
      status.textContent = text;
      status.className = isError ? 'status status--error' : 'status';
    };

    const retry = (text) => {
      say(text, true);
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = 'Try again';
      button.addEventListener('click', () => {
        say('Retrying…');
        delete player.dataset.triedDirect;
        player.src = '/play/' + player.dataset.videoId;
        player.load();
        player.play().catch(() => {});
      });
      status.append(button);
    };

    player.addEventListener('loadstart', () => {
      if (!player.dataset.everPlayed) say('Preparing the track… the first play can take a few seconds.');
    });
    player.addEventListener('canplay', () => say(''));
    player.addEventListener('playing', () => {
      player.dataset.everPlayed = '1';
      say('');
    });
    player.addEventListener('waiting', () => say('Buffering…'));

    player.addEventListener('error', async () => {
      // Backup plan: the browser's own network stack respects the system
      // proxy that the server's fetch may not. /stream redirects the audio
      // element straight to the CDN, so it can succeed where /play failed.
      if (!player.dataset.triedDirect) {
        player.dataset.triedDirect = '1';
        say('Server route failed — trying a direct connection…');
        player.src = '/stream/' + player.dataset.videoId;
        player.load();
        player.play().catch(() => {});
        return;
      }

      say('Could not play this track. Checking why…', true);
      try {
        const response = await fetch('/play/' + player.dataset.videoId, { headers: { Range: 'bytes=0-0' } });
        if (response.ok || response.status === 206) {
          retry('The server sent audio, but this browser could not decode it.');
        } else {
          const detail = (await response.text()).slice(0, 300);
          retry('Server: ' + (detail || 'HTTP ' + response.status));
        }
      } catch {
        retry('Could not reach the server. Is it still running?');
      }
    });
  }
</script>
</body>
</html>
`;
}
