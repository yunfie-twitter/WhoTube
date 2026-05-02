export * from './constants.js';
export * from './utils.js';
export * from './network.js';
export * from './potoken.js';
export * from './instances.js';

import { getYouTube } from './instances.js';
import { fetchPoToken } from './potoken.js';
import { YouTubeClientType } from '../types.js';

export async function initAllClients() {
  const clientsToInit: YouTubeClientType[] = ['WEB', 'MWEB', 'TV', 'ANDROID', 'IOS', 'ANDROID_VR', 'WEB_REMIX', 'WEB_SAFARI'];
  for (const client of clientsToInit) {
    try {
      await getYouTube(client);
      fetchPoToken(undefined, client).catch(() => { });
    } catch (e: any) {
      console.error(`[YouTube] ${client} warm-up failed: ${e.message}`);
    }
  }
}
