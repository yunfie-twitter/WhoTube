import { Pool, Agent } from 'undici';
import { Readable } from 'node:stream';
import { YouTubeClientType } from '../types.js';
import { RATE_LIMIT_INTERVAL_MS, COOLDOWN_BASE_MS, COOLDOWN_MAX_MS, COOLDOWN_SOFT_WAIT_MS } from './constants.js';
import { sleep } from './utils.js';

export const requestQueues = new Map<string, Promise<void>>();
export const cooldowns = new Map<string, { until: number; failures: number; reason: string }>();
export const mediaPools = new Map<string, Pool>();
export let preferredFamily: 4 | 6 | undefined = undefined;

export function setPreferredIPFamily(family: 4 | 6 | undefined) {
  preferredFamily = family;
  mediaPools.forEach(p => p.close());
  mediaPools.clear();
}

export function getMediaPool(host: string, localAddress?: string) {
  const poolKey = `${host}:${localAddress || 'default'}`;
  let pool = mediaPools.get(poolKey);
  if (!pool) {
    pool = new Pool(`https://${host}`, {
      connections: 256,
      pipelining: 4,
      keepAliveTimeout: 90000,
      keepAliveMaxTimeout: 600000,
      headersTimeout: 20000,
      bodyTimeout: 15000,
      connect: {
        timeout: 20000,
        keepAlive: true,
        keepAliveInitialDelay: 60000,
        family: preferredFamily,
        localAddress: localAddress,
        rejectUnauthorized: false 
      }
    });
    mediaPools.set(poolKey, pool);
  }
  return pool;
}

export function getCooldownKey(clientType?: string, host = 'youtube') {
  return `${clientType || 'default'}:${host}`;
}

export async function waitForRateLimit(bucket: string) {
  const previous = requestQueues.get(bucket) ?? Promise.resolve();
  let release!: () => void;
  const current = previous.then(() => new Promise<void>((resolve) => {
    release = resolve;
  }));
  requestQueues.set(bucket, current.catch(() => undefined));
  await previous;
  await sleep(RATE_LIMIT_INTERVAL_MS);
  release();
}

export function markCooldown(key: string, reason: string) {
  const previous = cooldowns.get(key);
  const failures = Math.min((previous?.failures ?? 0) + 1, 6);
  const duration = Math.min(COOLDOWN_BASE_MS * 2 ** (failures - 1), COOLDOWN_MAX_MS);
  const until = Date.now() + duration;
  cooldowns.set(key, { until, failures, reason });
  console.warn(`[YouTube] Cooldown ${key} for ${Math.round(duration / 1000)}s | Reason: ${reason}`);
}

export function clearCooldown(key: string) {
  cooldowns.delete(key);
}

export function isYouTubeClientCoolingDown(clientType: any, host = 'youtube') {
  if (!clientType) return false;
  const now = Date.now();
  const key = getCooldownKey(clientType, host);
  const state = cooldowns.get(key);
  if (state && state.until > now) return true;
  const globalKey = getCooldownKey(clientType);
  const globalState = cooldowns.get(globalKey);
  return !!(globalState && globalState.until > now);
}

export function coolDownYouTubeClient(clientType: any, type: 'youtube' | 'pot' = 'youtube') {
  markCooldown(getCooldownKey(clientType, type), 'forced cooldown');
}

export function noteYouTubeClientFailure(clientType: YouTubeClientType, reason = 'request failed', host = 'youtube') {
  const bucket = host.includes('googlevideo.com') ? 'media' : host;
  if (bucket === 'media') return;
  markCooldown(getCooldownKey(clientType, bucket), reason);
}

const RETRY_STATUSES = new Set([400, 403, 408, 409, 410, 416, 429, 500, 502, 503, 504]);

export async function stableFetch(input: RequestInfo | URL, init: RequestInit = {}, clientType?: string, localAddress?: string) {
  const url = typeof input === 'string' ? new URL(input) : (input instanceof URL ? input : new URL(input.url));
  const host = url.hostname;
  const isMedia = host.includes('googlevideo.com');
  const bucket = isMedia ? 'media' : (host.includes('youtube.com') ? 'youtube' : host);
  const cooldownKey = getCooldownKey(clientType, bucket);

  const cooldown = cooldowns.get(cooldownKey) ?? cooldowns.get(getCooldownKey(clientType));
  if (cooldown && cooldown.until > Date.now()) {
    const remaining = cooldown.until - Date.now();
    if (remaining <= COOLDOWN_SOFT_WAIT_MS) {
      await sleep(remaining);
    } else {
      throw new Error(`Client ${clientType || 'default'} is cooling down (${bucket}): ${cooldown.reason}`);
    }
  }

  if (!isMedia) {
    const jitter = Math.random() * 40 + 10;
    await sleep(jitter);
    await waitForRateLimit(cooldownKey);
  }

  if (isMedia) {
    const headers: Record<string, string> = {};
    const initHeaders = new Headers(init.headers);
    initHeaders.forEach((v, k) => { headers[k] = v; });
    const maxRetries = 3;
    let lastError: any = null;
    let currentUrl = url;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const targetHost = currentUrl.hostname;
        const mediaPool = getMediaPool(targetHost, localAddress);
        const res = await mediaPool.request({
          path: currentUrl.pathname + currentUrl.search,
          method: (init.method || 'GET') as any,
          headers: headers as any,
          body: init.body as any,
          signal: init.signal
        });

        if (res.statusCode >= 200 && res.statusCode < 300) {
          clearCooldown(cooldownKey);
          const response = new Response(Readable.toWeb(res.body as any) as any, {
            status: res.statusCode,
            headers: res.headers as any
          });
          Object.defineProperty(response, 'url', { value: currentUrl.toString() });
          return response;
        }

        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && attempt < maxRetries - 1) {
          try { await res.body.dump(); } catch (e) {}
          currentUrl = new URL(res.headers.location as string, currentUrl);
          continue;
        }

        if (RETRY_STATUSES.has(res.statusCode) && attempt < maxRetries - 1) {
          try { await res.body.dump(); } catch (e) {}
          if (res.statusCode === 403 || res.statusCode === 429) {
            return new Response(null, { status: res.statusCode, headers: res.headers as any });
          }
          const backoff = Math.pow(2, attempt) * 200 + Math.random() * 100;
          await sleep(backoff);
          continue;
        }

        const bodyStream = Readable.toWeb(res.body as any);
        const response = new Response(bodyStream as any, {
          status: res.statusCode,
          headers: res.headers as any
        });
        Object.defineProperty(response, 'url', { value: currentUrl.toString() });
        return response;
      } catch (e: any) {
        lastError = e;
        if (e.name === 'AbortError' || e.code === 'UND_ERR_ABORTED') throw e;
        if (attempt === 0 && !preferredFamily && (e.code === 'ECONNRESET' || e.code === 'ETIMEDOUT' || e.code === 'EHOSTUNREACH')) {
          setPreferredIPFamily(4);
        }
        if (attempt < maxRetries - 1) {
          const backoff = Math.pow(2, attempt) * 300 + Math.random() * 100;
          await sleep(backoff);
          continue;
        }
      }
    }
    throw lastError || new Error('Media fetch failed after retries');
  }

  const fetchInit = { ...init };
  if (localAddress) {
    (fetchInit as any).dispatcher = new Agent({
      connect: {
        localAddress,
        family: preferredFamily
      }
    });
  }

  const response = await fetch(input, fetchInit);
  if (response.ok) {
    clearCooldown(cooldownKey);
    if (!isMedia) clearCooldown(getCooldownKey(clientType));
    return response;
  }
  if (RETRY_STATUSES.has(response.status) && response.status !== 416) {
    markCooldown(cooldownKey, `HTTP ${response.status}`);
  }
  return response;
}

export function applyCommonYouTubeHeaders(headers: Headers, ua: string, urlString?: string) {
  headers.set('User-Agent', ua);
  headers.set('Accept-Language', 'en-US,en;q=0.9,ja-JP;q=0.8,ja;q=0.7');

  const isJs = urlString?.endsWith('.js') || urlString?.includes('/yts/jsbin/');
  const isImage = urlString?.includes('.png') || urlString?.includes('.jpg') || urlString?.includes('.webp') || urlString?.includes('/vi/') || urlString?.includes('ytimg.com');
  const isApi = urlString?.includes('/youtubei/v1/') || urlString?.includes('/rpc/');
  const isMedia = urlString?.includes('googlevideo.com');

  if (!headers.has('Accept')) {
    if (isJs) headers.set('Accept', '*/*');
    else if (isImage) headers.set('Accept', 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8');
    else headers.set('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7');
  }

  headers.set('X-Goog-Api-Format-Version', '2');
  if (isApi) {
    headers.set('X-Goog-Request-Time', new Date().toISOString());
    if (Math.random() > 0.5) {
      headers.set('X-Client-Data', Buffer.from(Math.random().toString()).toString('base64').substring(0, 40));
    }
  }
  if (isApi || isMedia) headers.set('X-Timer', `${Date.now()}`);
  headers.set('Connection', 'keep-alive');

  if (isJs) {
    headers.set('Sec-Fetch-Dest', 'script');
    headers.set('Sec-Fetch-Mode', 'no-cors');
    headers.set('Sec-Fetch-Site', (urlString && urlString.includes('youtube.com')) ? 'same-origin' : 'cross-site');
  } else if (isApi) {
    headers.set('Sec-Fetch-Dest', 'empty');
    headers.set('Sec-Fetch-Mode', 'cors');
    headers.set('Sec-Fetch-Site', headers.has('Referer') ? 'same-origin' : 'same-site');
  } else if (isMedia) {
    headers.set('Sec-Fetch-Dest', 'video');
    headers.set('Sec-Fetch-Mode', 'cors');
    headers.set('Sec-Fetch-Site', 'cross-site');
  } else {
    headers.set('Upgrade-Insecure-Requests', '1');
    headers.set('Sec-Fetch-Dest', 'document');
    headers.set('Sec-Fetch-Mode', 'navigate');
    headers.set('Sec-Fetch-Site', headers.has('Referer') ? 'same-origin' : 'none');
    headers.set('Sec-Fetch-User', '?1');
  }

  if (ua.includes('Chrome')) {
    const versionMatch = ua.match(/Chrome\/(\d+)/);
    const majorVersion = versionMatch ? versionMatch[1] : '125';
    headers.set('Sec-Ch-Ua', `"Not/A)Brand";v="8", "Chromium";v="${majorVersion}", "Google Chrome";v="${majorVersion}"`);
    headers.set('Sec-Ch-Ua-Mobile', ua.includes('Mobile') ? '?1' : '?0');
    headers.set('Sec-Ch-Ua-Platform', ua.includes('Windows') ? '"Windows"' : ua.includes('Macintosh') ? '"macOS"' : ua.includes('Linux') ? '"Linux"' : ua.includes('Android') ? '"Android"' : '"Unknown"');
  }

  return headers;
}
