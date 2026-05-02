import { FastifyRequest, FastifyReply } from 'fastify';
import { getYouTube, isYouTubeClientCoolingDown, getYouTubeForPlayback } from '../lib/youtube.js';
import { YouTubeClientType } from '../lib/types.js';
import { ManifestService } from '../services/manifest.service.js';
import { isValidVideoId } from '../lib/proxy.utils.js';
import { stableFetch } from '../lib/youtube.js';

import { getCompanionBaseUrl } from '../lib/companion.js';
import { config } from '../lib/config.js';
const COMPANION_SECRET = config.companion.secret;
const manifestCache = new Map<string, { body: string; timestamp: number }>();
const CACHE_TTL = 60 * 1000; // 1分間

export class ManifestProxyHandler {
  static async handleDashManifest(request: FastifyRequest, reply: FastifyReply) {
    const { v: videoId, codec } = request.query as { v?: string; codec?: string };
    if (!videoId || !isValidVideoId(videoId)) return reply.status(400).send('Invalid video id');

    const ac = new AbortController();
    request.raw.on('close', () => ac.abort());

    const clients: YouTubeClientType[] = ['ANDROID', 'ANDROID_VR', 'WEB_REMIX', 'TV', 'WEB_SAFARI', 'WEB', 'MWEB'];
    const preferredCodec = codec || 'vp9';
    const cacheKey = `dash:${videoId}:${preferredCodec}`;

    const cached = manifestCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return reply.status(200)
        .header('Content-Type', 'application/dash+xml; charset=utf-8')
        .header('X-Manifest-Cache', 'HIT')
        .header('Access-Control-Allow-Origin', '*')
        .send(cached.body);
    }

    try {
      const xml = await Promise.any(clients.map(async (client) => {
        if (isYouTubeClientCoolingDown(client)) throw new Error('Cooling down');
        const { yt } = await getYouTubeForPlayback(videoId, client);
        const manifest = await ManifestService.getManifest(videoId, '', yt);
        const builtXml = ManifestService.buildDashManifest(videoId, [...(manifest.videoOnly || []), ...(manifest.audioOnly || [])], preferredCodec);
        if (!builtXml) throw new Error('Build failed');
        return builtXml;
      }));

      manifestCache.set(cacheKey, { body: xml, timestamp: Date.now() });
      return reply.status(200)
        .header('Content-Type', 'application/dash+xml; charset=utf-8')
        .header('Cache-Control', 'public, max-age=3600')
        .header('Access-Control-Allow-Origin', '*')
        .send(xml);
    } catch (e: any) {
      if (e.name === 'AbortError') return;
      const details = e.errors ? e.errors.map((err: any) => err.message).join(', ') : e.message;
      console.warn(`[Proxy] DASH manifest race failed for ${videoId}: ${details}. Trying sequential fallback.`);
    }

    for (const client of clients) {
      if (isYouTubeClientCoolingDown(client)) continue;
      try {
        const { yt } = await getYouTubeForPlayback(videoId, client);
        const manifest = await ManifestService.getManifest(videoId, '', yt);
        const xml = ManifestService.buildDashManifest(videoId, [...(manifest.videoOnly || []), ...(manifest.audioOnly || [])], preferredCodec);
        if (xml) {
          manifestCache.set(cacheKey, { body: xml, timestamp: Date.now() });
          return reply.status(200)
            .header('Content-Type', 'application/dash+xml; charset=utf-8')
            .header('Cache-Control', 'public, max-age=3600')
            .header('Access-Control-Allow-Origin', '*')
            .send(xml);
        }
      } catch (e: any) {
        if (e.name === 'AbortError') return;
        console.warn(`[Proxy] DASH sequential fallback failed for ${videoId} (${client}): ${e.message}`);
      }
    }
    return reply.status(500).send('DASH manifest failed');
  }

  static async handleHlsManifest(request: FastifyRequest, reply: FastifyReply) {
    const { v: videoId, codec } = request.query as { v?: string; codec?: string };
    if (!videoId || !isValidVideoId(videoId)) return reply.status(400).send('Invalid video id');

    const ac = new AbortController();
    request.raw.on('close', () => ac.abort());

    const clients: YouTubeClientType[] = ['ANDROID', 'MWEB', 'WEB_SAFARI', 'WEB_REMIX', 'WEB', 'TV', 'ANDROID_VR'];
    const cacheKey = `hls:${videoId}:${codec || 'default'}`;
    const cached = manifestCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return reply.status(200)
        .header('Content-Type', 'application/x-mpegURL')
        .header('X-Manifest-Cache', 'HIT')
        .header('Access-Control-Allow-Origin', '*')
        .send(cached.body);
    }

    try {
      const result = await Promise.any(clients.map(async (client) => {
        if (isYouTubeClientCoolingDown(client)) throw new Error('Cooling down');
        const { yt } = await getYouTubeForPlayback(videoId, client);
        const manifest = await ManifestService.getManifest(videoId, '', yt);

        if (manifest.nativeHlsUrl) {
          console.log(`[Proxy] Found native HLS for ${videoId} (${client})`);
          return { type: 'native', url: manifest.nativeHlsUrl };
        }

        const builtHls = ManifestService.buildHlsMasterPlaylist(videoId, [...(manifest.muxed || []), ...(manifest.videoOnly || []), ...(manifest.audioOnly || [])], codec);
        if (!builtHls) throw new Error('Build failed');
        return { type: 'built', body: builtHls };
      }));

      if (result.type === 'native') {
        return reply.redirect(result.url!);
      }

      const body = result.body!;

      manifestCache.set(cacheKey, { body, timestamp: Date.now() });
      return reply.status(200)
        .header('Content-Type', 'application/x-mpegURL')
        .header('Cache-Control', 'public, max-age=3600')
        .header('Access-Control-Allow-Origin', '*')
        .send(body);
    } catch (e: any) {
      if (e.name === 'AbortError') return;
      const details = e.errors ? e.errors.map((err: any) => err.message).join(', ') : e.message;
      console.warn(`[Proxy] HLS manifest race failed for ${videoId}: ${details}. Trying sequential fallback.`);
    }

    for (const client of clients) {
      if (isYouTubeClientCoolingDown(client)) continue;
      try {
        const { yt } = await getYouTubeForPlayback(videoId, client);
        const manifest = await ManifestService.getManifest(videoId, '', yt);

        if (manifest.nativeHlsUrl) {
          return reply.redirect(manifest.nativeHlsUrl);
        }

        const body = ManifestService.buildHlsMasterPlaylist(videoId, [...(manifest.muxed || []), ...(manifest.videoOnly || []), ...(manifest.audioOnly || [])], codec);
        return reply.status(200)
          .header('Content-Type', 'application/x-mpegURL')
          .header('Cache-Control', 'public, max-age=3600')
          .header('Access-Control-Allow-Origin', '*')
          .send(body);
      } catch (e: any) {
        if (e.name === 'AbortError') return;
      }
    }
    return reply.status(500).send('HLS manifest failed');
  }

  static async handleHlsMediaPlaylist(request: FastifyRequest, reply: FastifyReply) {
    const { v: videoId, type, itag, src } = request.query as { v?: string; type?: string; itag?: string; src?: string };
    if (!videoId || !isValidVideoId(videoId) || !type || !itag) return reply.status(400).send('Invalid parameters');
    const itagNumber = Number.parseInt(itag, 10);
    if (!Number.isFinite(itagNumber)) return reply.status(400).send('Invalid itag');

    const ac = new AbortController();
    request.raw.on('close', () => ac.abort());

    try {
      const { yt } = await getYouTubeForPlayback(videoId, 'WEB'); // デフォルトクライアント
      const manifest = await ManifestService.getManifest(videoId, '', yt);
      const streams = type === 'audio' ? manifest.audioOnly : manifest.videoOnly;
      const stream = (streams || []).find((candidate) => candidate.itag === itagNumber);
      if (!stream) return reply.status(404).send('Stream not found');
      const body = ManifestService.buildHlsMediaPlaylist(videoId, stream, src as YouTubeClientType);
      return reply.status(200).header('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8').header('Access-Control-Allow-Origin', '*').send(body);
    } catch (error: any) {
      if (error.name === 'AbortError') return;
      return reply.status(502).send('Gateway Error');
    }
  }

  static async handleCompanionDashProxy(request: FastifyRequest, reply: FastifyReply) {
    const { v: videoId } = request.query as { v?: string };
    if (!videoId || !isValidVideoId(videoId)) return reply.status(400).send('Invalid video id');

    try {
      const companionBaseUrl = getCompanionBaseUrl(videoId);
      const companionManifestUrl = `${companionBaseUrl}/api/manifest/dash/id/${videoId}?local=true`;
      const res = await stableFetch(companionManifestUrl, {
        headers: { 'Authorization': `Bearer ${COMPANION_SECRET}` }
      });
      if (!res.ok) throw new Error('Companion manifest fetch failed');
      let body = await res.text();

      // BaseURL を WhoTube 経由に書き換える
      // Companion が返す BaseURL は相対パス (/companion/videoplayback) か
      // 設定された絶対パス (https://music.tsub4sa.xyz/companion/videoplayback) の可能性がある
      body = body.replace(/<BaseURL>([^<]+)<\/BaseURL>/g, (match, p1) => {
        const decodedUrl = p1.replace(/&amp;/g, '&');
        // WhoTube のプロキシエンドポイントへ飛ばす
        const proxyUrl = `/api/proxy/companion/videoplayback?v=${videoId}&url=${encodeURIComponent(decodedUrl)}`;
        return `<BaseURL>${proxyUrl.replace(/&/g, '&amp;')}</BaseURL>`;
      });

      return reply.status(200)
        .header('Content-Type', 'application/dash+xml; charset=utf-8')
        .header('Cache-Control', 'public, max-age=3600')
        .header('Access-Control-Allow-Origin', '*')
        .send(body);
    } catch (e: any) {
      console.error(`[Proxy] Companion DASH proxy failed for ${videoId}:`, e.message);
      return reply.status(502).send('Companion proxy failed');
    }
  }
}
