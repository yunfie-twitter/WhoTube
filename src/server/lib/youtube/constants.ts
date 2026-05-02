import { config } from '../config.js';
import { getVpnIPs } from '../network.js';

export const COMPANION_SECRET = config.companion.secret;
export const COMPANION_BASE_URL = config.companion.baseUrl;

export const IP_ROTATION_LIST = config.youtube.ipRotationIps.length > 0 ? config.youtube.ipRotationIps : getVpnIPs();
export const IPV6_BLOCK = config.youtube.ipv6Block;

export const ACCEPT_LANGUAGE = config.youtube.acceptLanguage;
export const SEGMENT_CACHE_MAX_BYTES = config.proxy.segmentCacheMaxBytes;
export const SEGMENT_CACHE_MAX_ENTRY_BYTES = config.proxy.segmentCacheMaxEntryBytes;
export const SEGMENT_CACHE_TTL_MS = config.proxy.segmentCacheTtlMs;

export const RATE_LIMIT_INTERVAL_MS = config.youtube.rateLimitIntervalMs;
export const COOLDOWN_BASE_MS = config.youtube.cooldownBaseMs;
export const COOLDOWN_MAX_MS = config.youtube.cooldownMaxMs;
export const COOLDOWN_SOFT_WAIT_MS = config.youtube.cooldownSoftWaitMs;

export const INSTANCE_TTL = 6 * 60 * 60 * 1000;
export const MAX_REQUESTS_PER_SESSION = 50;

export const USER_AGENTS = {
  TV: [
    'Mozilla/5.0 (WebOS; SmartTV) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.117 Safari/537.36',
    'Mozilla/5.0 (Linux; Tizen 8.0; TV) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (PlayStation 5; 9.00) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15'
  ],
  ANDROID: [
    'com.google.android.youtube/19.45.36 (Linux; U; Android 15; en_US; Pixel 9 Pro; Build/AP3A.241005.015) [YTMobile]',
    'com.google.android.youtube/19.44.38 (Linux; U; Android 14; ja_JP; SM-S928B; Build/UP1A.231005.007) [YTMobile]',
    'Mozilla/5.0 (Linux; Android 15; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.6778.104 Mobile Safari/537.36'
  ],
  IOS: [
    'com.google.ios.youtube/19.45.2 (iPhone16,2; U; CPU iOS 18_1 like Mac OS X; ja_JP)',
    'com.google.ios.youtube/19.43.1 (iPad14,3; U; CPU OS 17_7 like Mac OS X; en_US)'
  ],
  WEB: [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
  ],
  MWEB: [
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Linux; Android 15; Pixel 9 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.6778.104 Mobile Safari/537.36'
  ],
  ANDROID_VR: [
    'com.google.android.youtube.vr/1.60.30 (Linux; U; Android 14; ja_JP; Quest 3S; Build/SQ3A.241005.015) [YTMobile]',
    'com.google.android.youtube.vr/1.58.12 (Linux; U; Android 12; en_US; Quest 3; Build/SQ3A.220605.009) [YTMobile]'
  ],
  WEB_REMIX: [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
  ],
  WEB_SAFARI: [
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15'
  ]
};

export const getRandomUA = (type: string) => {
  const list = (USER_AGENTS as any)[type] || USER_AGENTS.WEB;
  return list[Math.floor(Math.random() * list.length)];
};
