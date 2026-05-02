import { FastifyRequest, FastifyReply } from 'fastify';
import { Readable } from 'node:stream';
import {
  getYouTube,
  isYouTubeClientCoolingDown,
  coolDownYouTubeClient,
  stableFetch,
  validateVideoId
} from '../lib/youtube.js';
import { YouTubeClientType } from '../lib/types.js';
import { SabrStream } from 'googlevideo/sabr-stream';
import { EnabledTrackTypes, buildSabrFormat, parseRangeHeader } from 'googlevideo/utils';
import type { SabrFormat } from 'googlevideo/shared-types';
import { YouTubeService } from '../services/youtube.service.js';

import { getCompanionBaseUrl } from '../lib/companion.js';
import { config } from '../lib/config.js';
const COMPANION_SECRET = config.companion.secret;
const USE_COMPANION_PROXY = config.companion.useProxy;
import { ManifestService } from '../services/manifest.service.js';
import { 
  getSafeHeaders, 
  normalizeUpstreamRange, 
  getSegmentCache, 
  setSegmentCache, 
  isMuxedItag,
  sleep,
  SEGMENT_CACHE_MAX_ENTRY_BYTES
} from '../lib/proxy.utils.js';

export class MediaProxyHandler {
  static async handleSegment(request: FastifyRequest, reply: FastifyReply) {
    const { v: videoId, itag, src } = request.query as { v?: string; itag?: string; src?: string };
    const range = request.headers.range;
    if (!videoId || !itag || !validateVideoId(videoId)) return reply.status(400).send('Missing or invalid params');
    const safeVideoId = videoId;
    const itagNumber = Number.parseInt(itag, 10);
    if (!Number.isFinite(itagNumber)) return reply.status(400).send('Invalid itag');

    const preferredClient = (src as YouTubeClientType) || 'WEB';
    const upstreamRange = normalizeUpstreamRange(typeof range === 'string' ? range : undefined, itagNumber);

    // Companion Proxy を優先試行
    if (USE_COMPANION_PROXY && request.method === 'GET') {
      try {
        const { url: targetUrl } = await ManifestService.getDecipheredUrl(safeVideoId, itagNumber, preferredClient, undefined, false);
        const urlObj = new URL(targetUrl);
        const companionBaseUrl = getCompanionBaseUrl(safeVideoId);
        const companionProxyUrl = new URL(`${companionBaseUrl}/videoplayback`);
        urlObj.searchParams.forEach((val: string, key: string) => companionProxyUrl.searchParams.set(key, val));
        companionProxyUrl.searchParams.set('host', urlObj.host);
        
        console.log(`[Proxy] Routing via Companion: ${safeVideoId} itag=${itag}`);
        const yt = await getYouTube(preferredClient);
        const res = await stableFetch(companionProxyUrl.toString(), {
          method: 'GET',
          headers: getSafeHeaders(yt, upstreamRange, itagNumber)
        }, preferredClient);

        if (res.ok) {
          reply.status(res.status);
          ['content-type', 'content-length', 'content-range', 'accept-ranges', 'cache-control'].forEach(k => {
            const v = res.headers.get(k); if (v) reply.header(k, v);
          });
          reply.header('Access-Control-Allow-Origin', '*');
          return reply.send(Readable.fromWeb(res.body as any));
        }
      } catch (e) {
        console.warn(`[Proxy] Companion routing failed for ${safeVideoId}, falling back to direct:`, e);
      }
    }

    // HEADリクエストをGET + Range: bytes=0-0に変換して安定化
    if (request.method === 'HEAD') {
      const getRange = upstreamRange || 'bytes=0-0';
      const headClients: YouTubeClientType[] = [preferredClient, 'WEB', 'MWEB'];
      for (const client of headClients) {
        if (isYouTubeClientCoolingDown(client)) continue;
        try {
          const yt = await getYouTube(client);
          const { url: targetUrl } = await ManifestService.getDecipheredUrl(safeVideoId, itagNumber, client, yt, false);
          const res = await stableFetch(targetUrl, { method: 'GET', headers: getSafeHeaders(yt, getRange) }, client);
          if (res.ok) {
            await res.body?.cancel?.();
            reply.status(res.status);
            ['content-type', 'content-length', 'content-range', 'accept-ranges', 'cache-control'].forEach(k => {
              const v = res.headers.get(k); if (v) reply.header(k, v);
            });
            reply.header('Access-Control-Allow-Origin', '*');
            return reply.send();
          }
        } catch (e) { }
      }
      return reply.status(502).send('HEAD failed');
    }

    // 1. セグメントキャッシュチェック
    const segmentCacheKey = `${safeVideoId}:${itagNumber}:${upstreamRange || 'full'}`;
    const cachedSegment = getSegmentCache(segmentCacheKey);
    if (cachedSegment) {
      reply.status(cachedSegment.status);
      Object.entries(cachedSegment.headers).forEach(([key, value]) => reply.header(key, value));
      reply.header('X-Segment-Cache', 'HIT');
      reply.header('Access-Control-Allow-Origin', '*');
      return reply.send(cachedSegment.data);
    }

    // 2. プリフェッチキャッシュチェック
    const prefetched = YouTubeService.getPrefetchedData(safeVideoId, itagNumber);
    if (prefetched && (!range || range === 'bytes=0-' || range === 'bytes=0-1048575')) {
      return reply.status(200)
        .header('Content-Type', prefetched.contentType)
        .header('Accept-Ranges', 'bytes')
        .header('Access-Control-Allow-Origin', '*')
        .send(prefetched.data);
    }

    // 3. SABR ストリーミング試行
    try {
      if (!isYouTubeClientCoolingDown(preferredClient, 'youtube')) {
        const sabrResult = await MediaProxyHandler.handleSegmentWithSabr(request, safeVideoId, itagNumber, upstreamRange, reply, preferredClient);
        if (sabrResult) return;
      }
    } catch (e) {
      console.warn(`[Proxy] SABR fetch failed for ${preferredClient}, falling back to legacy:`, e);
    }

    // 4. 並列試行によるダイレクトフェッチ (複数クライアントを同時にレースさせる)
    const primaryClients: YouTubeClientType[] = [preferredClient, 'ANDROID_VR', 'TV', 'WEB'];
    
    try {
      const raceResult = await Promise.any(primaryClients.map(async (client) => {
        if (isYouTubeClientCoolingDown(client)) throw new Error('Cooling down');
        
        let { url: targetUrl, client: usedClient } = await ManifestService.getDecipheredUrl(safeVideoId, itagNumber, client, undefined, false);
        const yt = await getYouTube(usedClient);
        
        let response = await stableFetch(targetUrl, {
          headers: getSafeHeaders(yt, upstreamRange, itagNumber)
        }, usedClient);

        if (!response.ok && [403, 410].includes(response.status)) {
          await response.body?.cancel?.();
          await YouTubeService.refreshPlaybackPoToken(safeVideoId, usedClient);
          const refreshed = await ManifestService.getDecipheredUrl(safeVideoId, itagNumber, usedClient, undefined, false);
          response = await stableFetch(refreshed.url, {
            headers: getSafeHeaders(yt, upstreamRange, itagNumber)
          }, usedClient);
        }

        if (response.ok) return { response, targetUrl, usedClient };
        await response.body?.cancel?.();
        throw new Error(`Failed with status ${response.status}`);
      }));

      if (raceResult.response.ok) {
        return await MediaProxyHandler.sendSegmentResponse(raceResult.response, reply, safeVideoId, itagNumber, upstreamRange, segmentCacheKey, raceResult.usedClient, request, raceResult.targetUrl);
      }
    } catch (e) {
      // Parallel race failed or timed out, continuing to sequential
    }

    // 並列試行が失敗した場合、従来の順次試行を実施
    const directClients: YouTubeClientType[] = ['WEB_REMIX', 'WEB_SAFARI', 'WEB', 'ANDROID_VR', 'TV', 'MWEB', 'ANDROID', 'IOS'];
    for (const client of directClients) {
      if (isYouTubeClientCoolingDown(client, 'youtube') || YouTubeService.isVideoClientBlocked(safeVideoId, client)) {
        continue;
      }
      let targetUrl = '';
      try {
        const yt = await getYouTube(client);

        let response: Response | null = null;
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const deciphered = await ManifestService.getDecipheredUrl(safeVideoId, itagNumber, client, yt, false);
            targetUrl = deciphered.url;
            const usedClient = deciphered.client;
            
            response = await stableFetch(targetUrl, {
              headers: getSafeHeaders(yt, upstreamRange, itagNumber)
            }, usedClient);

            if (response.ok) break;

            if ([400, 403, 410].includes(response.status)) {
              try { await response.body?.cancel?.(); } catch (e) {}
              await YouTubeService.refreshPlaybackPoToken(safeVideoId, client);
              if (attempt === 1) YouTubeService.markVideoClientBlocked(safeVideoId, client);

              await sleep(200);
              continue;
            } else if (response.status === 416) {
              try { await response.body?.cancel?.(); } catch (e) {}
              response = await stableFetch(targetUrl, {
                headers: getSafeHeaders(yt, undefined, itagNumber)
              }, usedClient);
              if (response.ok) break;
            }
            break;
          } catch (e) {
            await YouTubeService.refreshPlaybackPoToken(safeVideoId, client);
            await sleep(200);
          }
        }

        if (response && response.ok) {
          return await MediaProxyHandler.sendSegmentResponse(response, reply, safeVideoId, itagNumber, upstreamRange, segmentCacheKey, client, request, targetUrl);
        }
        if (response) {
          try { await response.body?.cancel?.(); } catch (e) {}
        }
      } catch (e: any) {
        console.error(`[Proxy] Sequential segment fetch failed for ${safeVideoId} (${client}):`, e.message || e);
      }
    }

    // 5. Muxed フォールバック
    if (isMuxedItag(itagNumber)) {
      try {
        const yt = await getYouTube('WEB');
        const { url: targetUrl } = await ManifestService.getDecipheredUrl(safeVideoId, itagNumber, 'WEB', yt, false);
        const res = await stableFetch(targetUrl, { headers: getSafeHeaders(yt, upstreamRange) }, 'WEB');
        if (res.ok) {
          reply.status(res.status);
          ['content-type', 'content-length', 'content-range', 'accept-ranges', 'cache-control'].forEach(k => {
            const v = res.headers.get(k); if (v) reply.header(k, v);
          });
          reply.header('Access-Control-Allow-Origin', '*');
          // @ts-ignore
          return reply.send(res.body);
        }
      } catch (fallbackError) {
        console.error('[Proxy] muxed fallback failed:', fallbackError);
      }
    }

    return reply.status(502).send('Gateway Error');
  }

  private static async handleSegmentWithSabr(request: FastifyRequest, videoId: string, itag: number, range: string | undefined, reply: FastifyReply, preferredClient?: YouTubeClientType): Promise<boolean> {
    if (range) return false;

    const clients: YouTubeClientType[] = preferredClient ? [preferredClient] : ['WEB', 'MWEB', 'WEB_SAFARI', 'WEB_REMIX'];
    for (const clientType of clients) {
      if (isYouTubeClientCoolingDown(clientType, 'youtube')) continue;
      let clientClosed = false;
      try {
        const yt = await getYouTube(clientType as any);
        const { info, pot } = await YouTubeService.getPlaybackInfo(videoId, clientType, yt);
        const streamingData = info.streaming_data;
        const ustreamerConfig = streamingData?.video_playback_ustreamer_config || streamingData?.videoPlaybackUstreamerConfig;
        const sabrUrl = streamingData?.server_abr_streaming_url || streamingData?.serverAbrStreamingUrl;

        if (!sabrUrl || !ustreamerConfig) continue;

        const sabrFormats: SabrFormat[] = (streamingData.adaptive_formats || []).map((format: any) => buildSabrFormat(format));
        const targetFormat = sabrFormats.find((format) => Number(format.itag) === itag);
        if (!targetFormat) continue;

        const isVideo = Boolean(targetFormat.width || targetFormat.height || targetFormat.mimeType?.startsWith('video/'));
        const isAudio = Boolean(targetFormat.audioQuality || targetFormat.mimeType?.startsWith('audio/'));
        const enabledTrackTypes = isVideo ? EnabledTrackTypes.VIDEO_ONLY : EnabledTrackTypes.AUDIO_ONLY;

        const sabrStream = new SabrStream({
          serverAbrStreamingUrl: sabrUrl,
          videoPlaybackUstreamerConfig: ustreamerConfig,
          clientInfo: {
            clientName: clientType === 'WEB' ? 1 : clientType === 'TV' ? 5 : clientType === 'MWEB' ? 2 : 2,
            clientVersion: yt.session.context.client.clientVersion,
            osName: 'Android',
            osVersion: '14',
            deviceMake: 'Google',
            deviceModel: 'Pixel 8 Pro'
          },
          formats: sabrFormats,
          durationMs: Number(targetFormat.approxDurationMs || 0),
          poToken: pot?.poToken || yt.session.po_token,
          fetch: (input, init) => stableFetch(input, init, clientType)
        });

        const { videoStream, audioStream } = await sabrStream.start({
          videoFormat: isVideo ? itag : undefined,
          audioFormat: isAudio ? itag : undefined,
          enabledTrackTypes
        });

        request.raw.on('close', () => {
          clientClosed = true;
          sabrStream.abort();
        });

        const stream = isVideo ? videoStream : audioStream;
        const reader = stream.getReader();

        let firstChunk = await reader.read();
        if (firstChunk.done || !firstChunk.value) {
          sabrStream.abort();
          continue;
        }

        reply.status(200)
          .header('Content-Type', targetFormat.mimeType || 'application/octet-stream')
          .header('Access-Control-Allow-Origin', '*')
          .header('X-Content-Source', 'SABR');

        const outStream = new ReadableStream({
          async start(controller) {
            controller.enqueue(firstChunk.value);
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              controller.enqueue(value);
            }
            controller.close();
            sabrStream.abort();
          },
          cancel() {
            sabrStream.abort();
          }
        });

        reply.send(outStream);
        return true;
      } catch (e: any) {
        if (e?.message === 'Download aborted.' || request.raw.destroyed) return true;
        if (!clientClosed) coolDownYouTubeClient(clientType, 'youtube');
      }
    }
    return false;
  }

  /**
   * チャンク分割フェッチを行い、スロットリングを回避しながらデータをストリーミングする
   * (invidious-companion の手法を参考)
   */
  private static async chunkedFetch(
    targetUrl: string, 
    headers: Record<string, string>, 
    clientType: YouTubeClientType, 
    range: { start: number, end: number }, 
    controller: ReadableStreamDefaultController,
    signal?: AbortSignal
  ) {
    const url = new URL(targetUrl);
    const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
    const body = new Uint8Array([0x78, 0]); // protobuf: { 15: 0 }

    for (let currentStart = range.start; currentStart <= range.end; currentStart += CHUNK_SIZE) {
      if (signal?.aborted) break;

      const currentEnd = Math.min(currentStart + CHUNK_SIZE - 1, range.end);
      url.searchParams.set('range', `${currentStart}-${currentEnd}`);

      const res = await stableFetch(url.toString(), {
        method: 'POST',
        body,
        headers,
        signal
      }, clientType);

      if (!res.ok) {
        throw new Error(`Chunked fetch failed: ${res.status}`);
      }

      if (res.body) {
        const reader = (res.body as any).getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(value);
        }
      }
    }
  }

  private static async prefetchNextSegments(videoId: string, itag: number, currentRange: string | undefined, clientType?: YouTubeClientType) {
    if (!currentRange) return;
    const parsed = parseRangeHeader(currentRange);
    if (!parsed) return;

    const CHUNK_SIZE = 2.5 * 1024 * 1024;
    const start = parsed.start;
    const nextRange = `bytes=${start + CHUNK_SIZE}-${start + 2 * CHUNK_SIZE - 1}`;

    setTimeout(async () => {
      try {
        const { url: targetUrl, client: usedClient } = await ManifestService.getDecipheredUrl(videoId, itag, clientType || 'WEB', undefined, true);
        const yt = await getYouTube(usedClient);
        const res = await stableFetch(targetUrl, { headers: getSafeHeaders(yt, nextRange) }, usedClient);
        if (res.ok) {
          const data = Buffer.from(await res.arrayBuffer());
          const contentType = res.headers.get('content-type') || 'application/octet-stream';
          YouTubeService.setPrefetchedData(videoId, itag, data, contentType);
        }
      } catch (e) {}
    }, 1200);
  }

  private static async sendSegmentResponse(response: Response, reply: FastifyReply, videoId: string, itag: number, range: string | undefined, cacheKey: string, clientType: YouTubeClientType | undefined, request: FastifyRequest, targetUrl: string) {
    const responseHeaders: Record<string, string> = {};
    ['content-type', 'content-length', 'content-range', 'accept-ranges', 'cache-control'].forEach(k => {
      const v = response.headers.get(k);
      if (v) responseHeaders[k] = v;
    });
 
    MediaProxyHandler.prefetchNextSegments(videoId, itag, range, clientType);

    const contentLength = Number(response.headers.get('content-length') || 0);
    const canCache = response.status === 206 && contentLength > 0 && contentLength <= SEGMENT_CACHE_MAX_ENTRY_BYTES;

    reply.status(response.status);
    Object.entries(responseHeaders).forEach(([key, value]) => reply.header(key, value));
    reply.header('Access-Control-Allow-Origin', '*');

    if (canCache) {
      reply.header('X-Segment-Cache', 'MISS-STREAMING');
      const chunks: Buffer[] = [];
      const body = response.body as any;

      const stream = new ReadableStream({
        async start(controller) {
          const reader = body.getReader();
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              chunks.push(Buffer.from(value));
              controller.enqueue(value);
            }
            setSegmentCache(cacheKey, { data: Buffer.concat(chunks), headers: responseHeaders, status: response.status });
            controller.close();
          } catch (e) {
            controller.error(e);
          }
        }
      });
      // @ts-ignore
      return reply.send(Readable.fromWeb(stream));
    }

    reply.header('X-Segment-Cache', 'BYPASS');

    const totalLength = Number(response.headers.get('content-length') || 0);
    const clientTypeToUse = clientType || 'WEB';
    
    // チャンク分割フェッチを使用してスロットリングを回避するストリーム
    const resilientStream = new ReadableStream({
      async start(controller) {
        try {
          const parsedRange = parseRangeHeader(range || '');
          const start = parsedRange?.start || 0;
          const end = parsedRange?.end || (totalLength > 0 ? start + totalLength - 1 : undefined);

          if (end !== undefined) {
            // 範囲が確定している場合は chunkedFetch を使用
            await MediaProxyHandler.chunkedFetch(
              targetUrl,
              responseHeaders,
              clientTypeToUse,
              { start, end },
              controller,
              (request.raw as any).signal
            );
          } else {
            // 範囲不明の場合は通常のストリーム転送
            const reader = (response.body as any).getReader();
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              controller.enqueue(value);
            }
          }
          controller.close();
        } catch (err: any) {
          if (err.name === 'AbortError') return;
          console.error(`[Proxy] Stream error for ${videoId}:`, err.message);
          controller.error(err);
        }
      }
    });

    return reply.send(Readable.fromWeb(resilientStream as any));
  }

  static async handleCompanionVideoplayback(request: FastifyRequest, reply: FastifyReply) {
    const { url } = request.query as { url?: string };
    if (!url) return reply.status(400).send('Missing url');

    // デコードして絶対パスであることを保証する
    let targetUrl = decodeURIComponent(url);
    if (targetUrl.startsWith('/')) {
      const companionBaseUrl = getCompanionBaseUrl(request.ip);
      const base = companionBaseUrl.replace(/\/companion$/, '');
      targetUrl = base + targetUrl;
    }

    try {
      // Companion へリクエストを転送 (Auth ヘッダーを付与)
      const upstreamRes = await fetch(targetUrl, {
        method: request.method,
        headers: {
          'Authorization': `Bearer ${COMPANION_SECRET}`,
          'Range': request.headers.range || '',
          'User-Agent': request.headers['user-agent'] || 'WhoTube/1.0'
        }
      });

      reply.status(upstreamRes.status);
      ['content-type', 'content-length', 'content-range', 'accept-ranges', 'cache-control'].forEach(k => {
        const v = upstreamRes.headers.get(k);
        if (v) reply.header(k, v);
      });
      reply.header('Access-Control-Allow-Origin', '*');

      if (!upstreamRes.body) return reply.send();
      return reply.send(Readable.fromWeb(upstreamRes.body as any));
    } catch (e: any) {
      console.error(`[Proxy] Companion videoplayback failed:`, e.message);
      return reply.status(502).send('Companion videoplayback proxy failed');
    }
  }
}
