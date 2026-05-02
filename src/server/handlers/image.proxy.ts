import { FastifyRequest, FastifyReply } from 'fastify';
import { stableFetch } from '../lib/youtube.js';
import { IMAGE_PROXY_HOSTS, ACCEPT_LANGUAGE } from '../lib/proxy.utils.js';

export class ImageProxyHandler {
  static async handleImage(request: FastifyRequest, reply: FastifyReply) {
    const { url } = request.query as { url?: string };
    if (!url) return reply.status(400).send('Missing url');

    const ac = new AbortController();
    request.raw.on('close', () => ac.abort());

    let target: URL;
    try {
      target = new URL(url);
    } catch {
      return reply.status(400).send('Invalid url');
    }

    if (!['http:', 'https:'].includes(target.protocol)) {
      return reply.status(400).send('Unsupported protocol');
    }
    if (!IMAGE_PROXY_HOSTS.some((host) => target.hostname === host || target.hostname.endsWith(`.${host}`))) {
      return reply.status(403).send('Image host is not allowed');
    }

    try {
      const response = await stableFetch(target, {
        signal: ac.signal,
        method: request.method,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          'Accept-Language': ACCEPT_LANGUAGE,
          'Referer': 'https://www.youtube.com/'
        }
      }, 'IMAGE' as any);

      if (!response.ok || (request.method === 'GET' && !response.body)) {
        return reply.status(response.status || 502).send('Image proxy failed');
      }

      const contentType = response.headers.get('content-type') || 'application/octet-stream';
      if (!contentType.startsWith('image/')) {
        await response.body?.cancel?.();
        return reply.status(415).send('Upstream is not an image');
      }
      if (contentType.includes('svg')) {
        await response.body?.cancel?.();
        return reply.status(415).send('SVG is not allowed');
      }

      reply
        .status(200)
        .header('Content-Type', contentType)
        .header('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800')
        .header('Access-Control-Allow-Origin', '*');

      if (request.method === 'HEAD') {
        await response.body?.cancel?.();
        return reply.send();
      }
      // @ts-ignore
      return reply.send(response.body);
    } catch (error) {
      console.error('[Proxy] image failed:', error);
      return reply.status(502).send('Image proxy failed');
    }
  }
}
