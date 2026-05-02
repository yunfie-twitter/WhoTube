import { Innertube, Utils } from 'youtubei.js';
import vm from 'node:vm';
import { YouTubeClientType } from '../types.js';
import { getRandomUA, INSTANCE_TTL, MAX_REQUESTS_PER_SESSION } from './constants.js';
import { getNextLocalIP } from './utils.js';
import { fetchPoToken } from './potoken.js';
import { stableFetch, applyCommonYouTubeHeaders, isYouTubeClientCoolingDown } from './network.js';

export const instances: Map<string, { yt: Innertube; timestamp: number; ua: string; requestCount: number; localAddress?: string }> = new Map();
export const creationPromises: Map<string, Promise<Innertube>> = new Map();
export const sessionState = new Map<string, { ua: string; visitorData?: string }>();

export function getSessionState(key: string, clientType: string) {
  let state = sessionState.get(key);
  if (!state) {
    const ua = getRandomUA(clientType);
    state = { ua };
    sessionState.set(key, state);
  }
  return state;
}

export async function getYouTube(
  clientType: YouTubeClientType = 'WEB',
  userId?: string,
  cookie?: string
) {
  const key = userId || clientType;
  const cached = instances.get(key);
  if (cached && (Date.now() - cached.timestamp < INSTANCE_TTL) && cached.requestCount < MAX_REQUESTS_PER_SESSION) {
    cached.requestCount++;
    return cached.yt;
  }
  
  if (creationPromises.has(key)) return creationPromises.get(key)!;

  const createPromise = (async () => {
    try {
      if (isYouTubeClientCoolingDown(clientType, 'youtube')) throw new Error(`Client ${clientType} is cooling down`);
      const state = getSessionState(key, clientType);
      const ua = state.ua;
      const localAddress = getNextLocalIP();

      Utils.Platform.load({
        ...Utils.Platform.shim,
        eval: (data: { output: string, exported: string[] }, env: any) => vm.runInNewContext(`(() => { ${data.output} })()`, env)
      });

      const pot = await Promise.race([
        fetchPoToken(undefined, clientType),
        new Promise<null>(resolve => setTimeout(() => resolve(null), 5000))
      ]);

      const yt = await Innertube.create({
        generate_session_locally: clientType !== 'TV' && clientType !== 'ANDROID_VR',
        retrieve_player: true,
        client_type: (clientType === 'TV' ? 'TVHTML5' : clientType) as any,
        cookie: cookie,
        po_token: pot?.poToken,
        visitor_data: state.visitorData || pot?.visitorData,
        fetch: (input, init) => {
          const urlString = typeof input === 'string' ? input : (input instanceof URL ? input.toString() : input.url);
          const headers = applyCommonYouTubeHeaders(new Headers(init?.headers), ua, urlString);
          if (['WEB', 'MWEB', 'WEB_REMIX', 'WEB_SAFARI'].includes(clientType)) {
            headers.set('Referer', 'https://www.youtube.com/');
          }
          return stableFetch(input, { ...init, headers }, clientType, localAddress);
        }
      });
      
      yt.session.context.client.userAgent = ua;
      state.visitorData = yt.session.context.client.visitorData || state.visitorData || pot?.visitorData;

      instances.set(key, { yt, timestamp: Date.now(), ua, requestCount: 1, localAddress });
      return yt;
    } catch (e: any) {
      setTimeout(() => creationPromises.delete(key), 2000);
      throw e;
    }
  })();

  creationPromises.set(key, createPromise);
  return createPromise;
}

export async function getYouTubeForPlayback(
  videoId: string,
  clientType: YouTubeClientType = 'WEB',
  userId?: string,
  cookie?: string
) {
  const yt = await getYouTube(clientType, userId, cookie);
  const state = getSessionState(userId || clientType, clientType);
  let pot = null;
  if (['WEB', 'MWEB', 'WEB_SAFARI', 'WEB_REMIX', 'ANDROID_VR'].includes(clientType)) {
    try { pot = await fetchPoToken(videoId, clientType); }
    catch (e) { pot = await fetchPoToken(undefined, clientType); }
  }
  return { yt, pot, userAgent: state.ua };
}

export function removeYouTubeInstance(clientType: YouTubeClientType) {
  instances.delete(clientType);
  creationPromises.delete(clientType);
}
