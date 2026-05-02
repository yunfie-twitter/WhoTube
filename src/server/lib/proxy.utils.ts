import { parseRangeHeader } from 'googlevideo/utils';

export const IMAGE_PROXY_HOSTS = ['ytimg.com', 'googleusercontent.com', 'ggpht.com'];
import { config } from './config.js';
export const ACCEPT_LANGUAGE = config.youtube.acceptLanguage;

export const SEGMENT_CACHE_MAX_BYTES = config.proxy.segmentCacheMaxBytes;
export const SEGMENT_CACHE_MAX_ENTRY_BYTES = config.proxy.segmentCacheMaxEntryBytes;
export const SEGMENT_CACHE_TTL_MS = config.proxy.segmentCacheTtlMs;

export interface SegmentCacheEntry {
  data: Buffer;
  headers: Record<string, string>;
  status: number;
  timestamp: number;
  size: number;
}

const segmentCache = new Map<string, SegmentCacheEntry>();
let segmentCacheBytes = 0;

export function isValidVideoId(id: string): boolean {
  return /^[a-zA-Z0-9_-]{11}$/.test(id);
}

export function getSegmentCache(key: string): SegmentCacheEntry | null {
  const cached = segmentCache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.timestamp > SEGMENT_CACHE_TTL_MS) {
    segmentCache.delete(key);
    segmentCacheBytes -= cached.size;
    return null;
  }
  segmentCache.delete(key);
  segmentCache.set(key, cached);
  return cached;
}

export function setSegmentCache(key: string, entry: Omit<SegmentCacheEntry, 'timestamp' | 'size'>) {
  const size = entry.data.byteLength;
  if (size <= 0 || size > SEGMENT_CACHE_MAX_ENTRY_BYTES) return;
  const previous = segmentCache.get(key);
  if (previous) segmentCacheBytes -= previous.size;
  segmentCache.set(key, { ...entry, timestamp: Date.now(), size });
  segmentCacheBytes += size;
  while (segmentCacheBytes > SEGMENT_CACHE_MAX_BYTES) {
    const oldestKey = segmentCache.keys().next().value;
    if (!oldestKey) break;
    const oldest = segmentCache.get(oldestKey);
    segmentCache.delete(oldestKey);
    if (oldest) segmentCacheBytes -= oldest.size;
  }
}

export function getSafeHeaders(yt: any, range?: string, itag?: number) {
  const ua = yt.session?.context?.client?.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
  const clientName = yt.session?.context?.client?.clientName;
  const clientVersion = yt.session?.context?.client?.clientVersion;

  const headers: Record<string, string> = {
    'User-Agent': ua,
    'Accept': '*/*',
    'Accept-Language': ACCEPT_LANGUAGE,
    'Origin': 'https://www.youtube.com',
    'Referer': 'https://www.youtube.com/',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'cross-site',
    'X-YouTube-Client-Name': clientName || '1',
    'X-YouTube-Client-Version': clientVersion || '2.20240520.00.00',
    'X-Goog-Api-Format-Version': '2'
  };

  if (range) headers['Range'] = range;
  if (yt.session?.context?.client?.visitorData) {
    headers['X-Goog-Visitor-Id'] = yt.session.context.client.visitorData;
  }

  if (yt.session?.po_token) {
    headers['X-YouTube-Identity-Token'] = yt.session.po_token;
  }

  return headers;
}

export function normalizeUpstreamRange(range?: string, itag?: number): string | undefined {
  if (!range) return undefined;
  const parsed = parseRangeHeader(range);
  if (!parsed) return undefined;

  const isHighBitrate = itag && [401, 400, 313, 315, 271, 272, 303, 308, 299, 298, 337, 312, 251, 258].includes(itag);
  const CHUNK_SIZE = (isHighBitrate ? 5 : 2.5) * 1024 * 1024;

  const start = parsed.start;
  const end = Number.isFinite(parsed.end) ? parsed.end : start + CHUNK_SIZE - 1;
  const actualEnd = Math.min(end, start + CHUNK_SIZE - 1);

  return `bytes=${start}-${actualEnd}`;
}

export function isMuxedItag(itag: number): boolean {
  const muxedItags = new Set([18, 22, 37, 38, 43, 44, 45, 46]);
  return muxedItags.has(itag);
}

export async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
