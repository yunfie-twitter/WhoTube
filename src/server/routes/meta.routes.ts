import { FastifyInstance } from 'fastify';
import { MetaService } from '../services/meta.service.js';

import { NotificationService } from '../services/notification.service.js';
import { ImageProxyHandler } from '../handlers/image.proxy.js';
import { config } from '../lib/config.js';

export async function metaRoutes(fastify: FastifyInstance) {
  fastify.get('/image.webp', ImageProxyHandler.handleImage);
  fastify.get('/api/meta/forced-subscriptions', async () => {
    const forcedIds = config.meta.forcedSubscriptionChannelIds;
;
    return {
      forcedSubscriptionChannelIds: forcedIds
    };
  });

  fastify.get('/api/notifications', {
    schema: {
      summary: 'Get Global Notifications',
      description: 'Returns active instance operator announcements.',
      tags: ['system']
    }
  }, async () => {
    return await NotificationService.getActiveNotifications();
  });

  // Watch page, Shorts, and Embeds with metadata injection
  fastify.get('/watch', handleMeta);
  fastify.get('/watch/:id', handleMeta);
  fastify.get('/shorts/:id', handleMeta);
  fastify.get('/embed/:id', handleMeta);

  async function handleMeta(req: any, reply: any) {
    const videoId = req.params.id || req.query.v;
    if (!videoId) {
      return reply.type('text/html').sendFile('index.html');
    }

    const baseUrl = `${req.protocol}://${req.hostname}`;
    const html = await MetaService.getWatchHtml(videoId, baseUrl);
    return reply.type('text/html').send(html);
  }

  // oEmbed API
  fastify.get('/api/oembed', {
    schema: {
      summary: 'oEmbed API',
      description: 'Returns oEmbed data for a video URL.',
      tags: ['youtube'],
      querystring: {
        type: 'object',
        required: ['url'],
        properties: {
          url: { type: 'string' },
          format: { type: 'string', enum: ['json'], default: 'json' }
        }
      }
    }
  }, async (req: any) => {
    const { url } = req.query;
    const baseUrl = `${req.protocol}://${req.hostname}`;
    return await MetaService.getOEmbed(url, baseUrl);
  });
}
