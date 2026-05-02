import { Worker } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Innertube } from 'youtubei.js';
import { config } from '../config.js';
import { getCompanionBaseUrl } from '../companion.js';
import { COMPANION_SECRET } from './constants.js';
import { stableFetch, isYouTubeClientCoolingDown, getCooldownKey, markCooldown } from './network.js';
import { YouTubeClientType } from '../types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const POTOKEN_WORKER_PATH = join(__dirname, '..', 'potoken.worker.ts');

export type PoTokenPayload = { poToken: string; visitorData?: string; source?: 'bgutils-js' | 'bgutils-worker' | 'api' | 'companion'; ttlMs?: number };

export const potCache = new Map<string, { data: PoTokenPayload, expiresAt: number }>();
export const potPromises = new Map<string, Promise<PoTokenPayload | null>>();
export const POT_TTL_SESSION = 45 * 60 * 1000;
export const POT_TTL_VIDEO = 10 * 60 * 1000;

export async function fetchPoTokenFromCompanion(videoId?: string): Promise<PoTokenPayload | null> {
  if (!videoId) return null;
  try {
    const companionBaseUrl = getCompanionBaseUrl(videoId);
    const res = await stableFetch(`${companionBaseUrl}/youtubei/v1/player`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${COMPANION_SECRET}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ videoId })
    });
    if (!res.ok) return null;
    const data = await res.json() as any;
    if (data.poToken || (data.attestation?.playerAttestationRenderer?.poToken)) {
       return {
         poToken: data.poToken || data.attestation.playerAttestationRenderer.poToken,
         visitorData: data.responseContext?.visitorData,
         source: 'companion'
       };
    }
  } catch (e) {
    console.warn('[Companion] PoToken fetch failed:', e);
  }
  return null;
}

export async function fetchPoTokenWithApi(videoId?: string, clientType?: string): Promise<PoTokenPayload | null> {
  try {
    const res = await stableFetch('http://localhost:4416/get_pot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content_binding: videoId,
        innertube_context: {
          client: {
            clientName: clientType || 'TV',
            clientVersion:
              clientType === 'TV' ? '2.20230922.00.00' :
                clientType === 'ANDROID' ? '19.45.36' :
                  clientType === 'IOS' ? '19.45.2' :
                    clientType === 'ANDROID_VR' ? '19.16.37' :
                      clientType === 'WEB_REMIX' ? '1.20240520.00.00' :
                        '2.20240520.00.00',
          }
        }
      })
    });
    if (!res.ok) throw new Error(`PoToken service error: ${res.status}`);
    const data = await res.json() as PoTokenPayload;
    return { ...data, source: 'api', ttlMs: videoId ? POT_TTL_VIDEO : POT_TTL_SESSION };
  } catch (e) {
    return null;
  }
}

async function validatePoTokenWithYouTube(poToken: string, visitorData: string | undefined, clientType: string): Promise<boolean> {
  try {
    const yt = await Innertube.create({
      client_type: (clientType === 'TV' ? 'TVHTML5' : clientType) as any,
      po_token: poToken,
      visitor_data: visitorData,
      fetch: (input, init) => stableFetch(input, init, clientType)
    });
    const player = await yt.getInfo('dQw4w9WgXcQ');
    return !!player.playability_status && player.playability_status.status === 'OK';
  } catch (e) {
    return false;
  }
}

export async function fetchPoTokenWithBgUtils(videoId?: string, clientType = 'WEB'): Promise<PoTokenPayload | null> {
  if (isYouTubeClientCoolingDown(clientType as YouTubeClientType)) return null;

  return new Promise((resolve) => {
    const worker = new Worker(POTOKEN_WORKER_PATH, {
      execArgv: config.isDev ? ['--loader', 'tsx'] : [],
    });
    
    const timeout = setTimeout(() => {
      worker.terminate();
      resolve(null);
    }, videoId ? 25000 : 15000);

    worker.on('message', async (msg) => {
      if (msg.type === 'success') {
        const needsValidation = !!videoId;
        const isValid = needsValidation ? await validatePoTokenWithYouTube(msg.data.poToken, msg.data.visitorData, clientType) : true;
        if (isValid) {
          clearTimeout(timeout);
          worker.terminate();
          resolve({ ...msg.data, source: 'bgutils-worker', ttlMs: videoId ? POT_TTL_VIDEO : POT_TTL_SESSION });
        } else {
          clearTimeout(timeout);
          worker.terminate();
          resolve(null);
        }
      } else {
        clearTimeout(timeout);
        worker.terminate();
        resolve(null);
      }
    });

    worker.on('error', (err: any) => {
      clearTimeout(timeout);
      worker.terminate();
      resolve(null);
    });

    worker.postMessage({ videoId, clientType });
  });
}

export async function fetchPoToken(videoId?: string, clientType?: string) {
  const cacheKey = `${videoId || 'session'}-${clientType || 'default'}`;
  const cached = potCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) return cached.data;
  if (potPromises.has(cacheKey)) return potPromises.get(cacheKey)!;

  const promise = (async () => {
    if (clientType && isYouTubeClientCoolingDown(clientType as YouTubeClientType)) return null;

    const companionResult = await fetchPoTokenFromCompanion(videoId);
    if (companionResult) {
      potCache.set(cacheKey, { data: companionResult, expiresAt: Date.now() + POT_TTL_SESSION });
      return companionResult;
    }

    const bgResult = await fetchPoTokenWithBgUtils(videoId, clientType);
    if (bgResult) {
      const ttlMs = bgResult.ttlMs ?? (videoId ? POT_TTL_VIDEO : POT_TTL_SESSION);
      potCache.set(cacheKey, { data: bgResult, expiresAt: Date.now() + ttlMs });
      return bgResult;
    }

    const apiResult = await fetchPoTokenWithApi(videoId, clientType);
    if (apiResult) {
      const ttlMs = apiResult.ttlMs ?? (videoId ? POT_TTL_VIDEO : POT_TTL_SESSION);
      potCache.set(cacheKey, { data: apiResult, expiresAt: Date.now() + ttlMs });
      return apiResult;
    }

    return null;
  })();

  potPromises.set(cacheKey, promise);
  try { return await promise; } finally { potPromises.delete(cacheKey); }
}

export function clearPoTokenCache(videoId?: string, clientType?: string) {
  const cacheKey = `${videoId || 'session'}-${clientType || 'default'}`;
  potCache.delete(cacheKey);
  return true;
}
