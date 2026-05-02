import { FastifyRequest, FastifyReply } from 'fastify';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { getYouTube, isYouTubeClientCoolingDown, stableFetch } from '../lib/youtube.js';
import { YouTubeClientType } from '../lib/types.js';
import { YouTubeService } from '../services/youtube.service.js';
import { isValidVideoId, getSafeHeaders } from '../lib/proxy.utils.js';

const require = createRequire(import.meta.url);
const ffmpegPath = require('ffmpeg-static') as string | null;

export class StreamProxyHandler {
  static async handleMergedStream(request: FastifyRequest, reply: FastifyReply) {
    const { v: videoId, vItag, aItag } = request.query as { v?: string; vItag?: string; aItag?: string };
    if (!videoId || !isValidVideoId(videoId) || !vItag || !aItag) return reply.status(400).send('Invalid parameters');
    if (!ffmpegPath) return reply.status(500).send('ffmpeg not available');
    
    const videoItag = Number.parseInt(vItag, 10);
    const audioItag = Number.parseInt(aItag, 10);
    if (!Number.isFinite(videoItag) || !Number.isFinite(audioItag)) return reply.status(400).send('Invalid itag');

    try {
      const videoProxyUrl = `http://localhost:3000/api/proxy/segment?v=${encodeURIComponent(videoId)}&itag=${videoItag}&src=WEB`;
      const audioProxyUrl = `http://localhost:3000/api/proxy/segment?v=${encodeURIComponent(videoId)}&itag=${audioItag}&src=WEB`;

      const ff = spawn(ffmpegPath, [
        '-nostdin', '-loglevel', 'error',
        '-reconnect', '1', '-reconnect_streamed', '1', '-reconnect_delay_max', '5',
        '-i', videoProxyUrl,
        '-reconnect', '1', '-reconnect_streamed', '1', '-reconnect_delay_max', '5',
        '-i', audioProxyUrl,
        '-map', '0:v:0', '-map', '1:a:0',
        '-c:v', 'copy', '-c:a', 'copy',
        '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
        '-f', 'mp4', 'pipe:1'
      ], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });

      const abort = () => { if (!ff.killed) ff.kill('SIGKILL'); };
      request.raw.on('close', abort);

      reply.hijack();
      reply.raw.writeHead(200, {
        'Content-Type': 'video/mp4',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store',
        'Accept-Ranges': 'none'
      });

      ff.stdout.pipe(reply.raw);

      ff.on('close', () => {
        request.raw.off('close', abort);
        if (!reply.raw.writableEnded) reply.raw.end();
      });
    } catch (e: any) {
      console.error('[Proxy] handleMergedStream failed:', e.message);
      return reply.status(500).send('Proxy failed');
    }
  }

  static async handleVideoProxy(request: FastifyRequest, reply: FastifyReply) {
    const { videoId } = request.params as { videoId: string };
    if (!videoId || !isValidVideoId(videoId)) return reply.status(400).send('Invalid video id');

    const ac = new AbortController();
    request.raw.on('close', () => ac.abort());

    const clients: YouTubeClientType[] = ['ANDROID_VR', 'WEB', 'MWEB', 'TV', 'ANDROID', 'IOS'];
    for (const clientType of clients) {
      if (isYouTubeClientCoolingDown(clientType)) continue;

      try {
        const yt = await getYouTube(clientType);
        for (let attempt = 0; attempt < 2; attempt++) {
          const { info } = await YouTubeService.getPlaybackInfo(videoId, clientType, yt);
          // chooseFormat is assumed to be available on info or via a helper
          const format = (info as any).chooseFormat?.({ type: 'video+audio', quality: 'best' });
          if (!format) throw new Error('No format found');

          const targetUrl = await format.decipher(yt.session.player);
          const res = await stableFetch(targetUrl, {
            signal: ac.signal,
            headers: getSafeHeaders(yt, request.headers.range as string)
          }, clientType);

          if (res.ok) {
            reply.status(res.status);
            ['content-type', 'content-length', 'content-range', 'accept-ranges'].forEach(k => {
              const v = res.headers.get(k); if (v) reply.header(k, v);
            });
            reply.header('Access-Control-Allow-Origin', '*');
            // @ts-ignore
            return reply.send(res.body);
          }
          await res.body?.cancel?.();
          await YouTubeService.refreshPlaybackPoToken(videoId, clientType);
        }
      } catch (e: any) {
        if (e.name === 'AbortError') return;
      }
    }
    return reply.status(500).send('Proxy failed');
  }
}
