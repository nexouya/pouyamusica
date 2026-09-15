/**
 * Provider chain with health tracking.
 *
 * Every engine can fail: YouTube breaks innertube clients, yt-dlp may not be
 * installed, public Invidious instances come and go, networks flap. The chain
 * tries each provider in order, remembers which ones are network-dead, and —
 * crucially — retries them after a cooldown, because the situation can change
 * mid-session (the user turns their VPN on, the network comes back).
 */

const NETWORK_ERROR =
  /fetch failed|ENOTFOUND|ECONNREFUSED|ECONNRESET|ETIMEDOUT|EAI_AGAIN|socket hang up|player id|abort|timeout|network/i;

export function createChain({
  providers,
  cooldownMs = 5 * 60 * 1000,
  now = Date.now,
  log = console
}) {
  /** name -> { at: timestamp of last network failure, error: message } */
  const failures = new Map();
  /** name -> { at: timestamp, method } of last success */
  const successes = new Map();

  function coolingDown(provider) {
    const failed = failures.get(provider.name);
    return failed !== undefined && now() - failed.at < cooldownMs;
  }

  async function availableProviders(method) {
    const checks = await Promise.all(
      providers.map(async (provider) => {
        if (typeof provider[method] !== 'function') return null;
        if (provider.isAvailable && !(await provider.isAvailable())) return null;
        return provider;
      })
    );
    return checks.filter(Boolean);
  }

  async function attempt(method, args) {
    const all = await availableProviders(method);
    if (all.length === 0) throw new Error(`no provider implements ${method}`);

    // Healthy providers first; the cooling-down ones only as a last resort.
    const healthy = all.filter((provider) => !coolingDown(provider));
    const ordered = healthy.length ? [...healthy, ...all.filter(coolingDown)] : all;

    const errors = [];
    for (const provider of ordered) {
      try {
        const result = await provider[method](...args);
        if (method === 'search' && (!result || result.length === 0)) {
          errors.push(`${provider.name}: no results`);
          continue;
        }
        if (failures.delete(provider.name)) {
          log.error(`[${provider.name}] recovered — back in rotation`);
        }
        successes.set(provider.name, { at: now(), method });
        return result;
      } catch (error) {
        errors.push(`${provider.name}: ${error.message}`);
        log.error(`[${provider.name}] ${method} failed: ${error.message}`);

        if (NETWORK_ERROR.test(error.message)) {
          failures.set(provider.name, { at: now(), error: error.message });
          log.error(
            `[${provider.name}] looks network-dead — deprioritised for ${Math.round(cooldownMs / 60000)} min`
          );
        }
      }
    }

    if (method === 'search' && errors.length && errors.every((entry) => entry.endsWith('no results'))) {
      return [];
    }
    throw new Error(errors.join(' | ') || 'no provider available');
  }

  return {
    search: (query, limit = 10) => attempt('search', [query, limit]),
    resolveStream: (videoId) => attempt('resolveStream', [videoId]),

    /** Per-engine health, for /api/status and the doctor. */
    status() {
      return providers.map((provider) => {
        const failed = failures.get(provider.name);
        const success = successes.get(provider.name);
        return {
          name: provider.name,
          state: failed
            ? coolingDown(provider)
              ? 'cooling-down'
              : 'retryable'
            : success
              ? 'healthy'
              : 'untried',
          lastError: failed?.error ?? null,
          lastSuccess: success?.at ?? null
        };
      });
    }
  };
}
