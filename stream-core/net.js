/**
 * Node's built-in fetch ignores proxy settings: it reads neither the
 * HTTP(S)_PROXY environment variables (unless NODE_USE_ENV_PROXY=1 on Node 24+)
 * nor the Windows system proxy in the registry. Python — and therefore yt-dlp —
 * reads both. That mismatch makes yt-dlp work while every fetch() fails.
 *
 * This module finds the proxy the rest of the system is already using and
 * teaches fetch() to use it too, including SOCKS proxies.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Agent, ProxyAgent, buildConnector, setGlobalDispatcher } from 'undici';
import { SocksClient } from 'socks';

const run = promisify(execFile);

const ENV_KEYS = [
  'PROXY_URL',
  'ALL_PROXY',
  'all_proxy',
  'HTTPS_PROXY',
  'https_proxy',
  'HTTP_PROXY',
  'http_proxy'
];

function normalizeProxyUrl(value) {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  const withScheme = /^[a-z0-9]+:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  try {
    const url = new URL(withScheme);
    return url.hostname ? url.toString().replace(/\/$/, '') : null;
  } catch {
    return null;
  }
}

function fromEnvironment() {
  for (const key of ENV_KEYS) {
    const url = normalizeProxyUrl(process.env[key]);
    if (url) return { url, source: `${key} environment variable` };
  }
  return null;
}

/**
 * Reads the Windows system proxy — what V2Ray, Clash, Nekoray, Proxifier and
 * similar clients configure when you flip "set as system proxy" on.
 */
async function fromWindowsRegistry() {
  if (process.platform !== 'win32') return null;

  try {
    const { stdout } = await run(
      'reg',
      ['query', 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings'],
      { timeout: 5000, windowsHide: true }
    );

    const enabled = /ProxyEnable\s+REG_DWORD\s+0x([0-9a-f]+)/i.exec(stdout);
    if (!enabled || Number.parseInt(enabled[1], 16) === 0) return null;

    const server = /ProxyServer\s+REG_SZ\s+(.+)/i.exec(stdout)?.[1]?.trim();
    if (!server) return null;

    // Either "host:port" or "http=host:port;https=host:port;socks=host:port".
    if (server.includes('=')) {
      const map = new Map(
        server.split(';').map((part) => {
          const [scheme, value] = part.split('=');
          return [scheme?.trim().toLowerCase(), value?.trim()];
        })
      );
      const socks = map.get('socks');
      const picked =
        map.get('https') ??
        map.get('http') ??
        (socks ? (/^socks/i.test(socks) ? socks : `socks5://${socks}`) : null);
      const url = normalizeProxyUrl(picked);
      return url ? { url, source: 'Windows system proxy (registry)' } : null;
    }

    const url = normalizeProxyUrl(server);
    return url ? { url, source: 'Windows system proxy (registry)' } : null;
  } catch {
    return null;
  }
}

/** Finds the proxy this machine is already using, if any. */
export async function detectProxy() {
  if (process.env.NO_PROXY_AUTODETECT === '1') return null;
  return fromEnvironment() ?? (await fromWindowsRegistry());
}

/** undici connector that tunnels through a SOCKS4/SOCKS5 proxy. */
function socksConnector(proxyUrl, connectOptions = {}) {
  const proxy = new URL(proxyUrl);
  const type = proxy.protocol.startsWith('socks4') ? 4 : 5;
  const tlsUpgrade = buildConnector(connectOptions);

  return async (options, callback) => {
    const host = options.hostname ?? options.host;
    const port = Number(options.port) || (options.protocol === 'https:' ? 443 : 80);

    try {
      const { socket } = await SocksClient.createConnection({
        proxy: {
          host: proxy.hostname,
          port: Number(proxy.port) || 1080,
          type,
          userId: proxy.username ? decodeURIComponent(proxy.username) : undefined,
          password: proxy.password ? decodeURIComponent(proxy.password) : undefined
        },
        command: 'connect',
        destination: { host, port },
        timeout: 20_000
      });

      // Plain HTTP needs no TLS; HTTPS gets wrapped on top of the tunnel.
      if (options.protocol !== 'https:') return callback(null, socket);
      return tlsUpgrade({ ...options, httpSocket: socket }, callback);
    } catch (error) {
      return callback(error, null);
    }
  };
}

/** Builds an undici dispatcher that routes all traffic through `proxyUrl`. */
export function createProxyDispatcher(proxyUrl, connectOptions = {}) {
  const protocol = new URL(proxyUrl).protocol;

  if (protocol.startsWith('socks')) {
    return new Agent({ connect: socksConnector(proxyUrl, connectOptions) });
  }
  // ProxyAgent keeps the two TLS hops separate: `proxyTls` for the connection
  // to the proxy, `requestTls` for the tunnelled connection to the target.
  return new ProxyAgent({
    uri: proxyUrl,
    requestTls: connectOptions,
    proxyTls: connectOptions
  });
}

/**
 * Points global fetch() at the detected proxy. Call once at startup.
 * @returns {Promise<{url: string, source: string} | null>}
 */
export async function installProxy() {
  if (process.env.NO_PROXY_AUTODETECT === '1') return null;

  const proxy = await detectProxy();
  if (!proxy) return null;

  setGlobalDispatcher(createProxyDispatcher(proxy.url));
  return proxy;
}
