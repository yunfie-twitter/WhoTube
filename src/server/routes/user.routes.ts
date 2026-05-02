import { FastifyInstance } from 'fastify';
import { UserDataService } from '../services/user-data.service.js';
import { ChannelService } from '../services/channel.service.js';

function baseUserSchema(summary: string, description: string) {
  return {
    summary,
    description,
    tags: ['user']
  };
}

export async function userRoutes(fastify: FastifyInstance) {
  fastify.post('/subscription-feed', {
    schema: {
      ...baseUserSchema('Get Local Subscription Feed', 'Aggregates latest uploaded videos for a client-managed channel list.'),
      body: {
        type: 'object',
        required: ['channelIds'],
        properties: {
          channelIds: {
            type: 'array',
            items: { type: 'string' }
          },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
          offset: { type: 'integer', minimum: 0, default: 0 }
        }
      }
    }
  }, async (request) => {
    const body = request.body as { channelIds?: string[]; limit?: number; offset?: number };
    const channelIds = Array.isArray(body.channelIds)
      ? [...new Set(body.channelIds.map((id) => String(id)).filter(Boolean))]
      : [];
    const limit = Number(body.limit || 50);
    const offset = Number(body.offset || 0);
    const items = await ChannelService.getSubscriptionFeed(channelIds, limit, offset);

    return {
      subscriptions: channelIds.length,
      items
    };
  });

  fastify.get('/:userId', {
    schema: {
      ...baseUserSchema('Get User Data', 'Returns persisted local user data.'),
      params: {
        type: 'object',
        required: ['userId'],
        properties: {
          userId: { type: 'string' }
        }
      }
    }
  }, async (request) => {
    const { userId } = request.params as { userId: string };
    return await UserDataService.getUserData(userId);
  });

  fastify.post('/:userId', {
    schema: {
      ...baseUserSchema('Replace User Data', 'Replaces the persisted local user data document.'),
      params: {
        type: 'object',
        required: ['userId'],
        properties: {
          userId: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        additionalProperties: true
      }
    }
  }, async (request) => {
    const { userId } = request.params as { userId: string };
    const data = await UserDataService.replaceUserData(userId, request.body);
    return { success: true, data };
  });

  fastify.get('/:userId/subscriptions', {
    schema: {
      ...baseUserSchema('List Subscriptions', 'Returns local channel subscriptions for the user.'),
      params: {
        type: 'object',
        required: ['userId'],
        properties: {
          userId: { type: 'string' }
        }
      }
    }
  }, async (request) => {
    const { userId } = request.params as { userId: string };
    const items = await UserDataService.listSubscriptions(userId);

    // Trigger background refresh for any items missing metadata (lazy loading)
    for (const item of items) {
      if (!item.thumbnail || !item.handle) {
        UserDataService.queueMetadataRefresh(userId, item.channelId);
      }
    }

    return {
      userId,
      items
    };
  });

  fastify.post('/:userId/subscriptions', {
    schema: {
      ...baseUserSchema('Subscribe To Channel', 'Adds or updates a channel subscription in local storage.'),
      params: {
        type: 'object',
        required: ['userId'],
        properties: {
          userId: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        required: ['channelId'],
        properties: {
          channelId: { type: 'string' },
          title: { type: 'string' },
          handle: { type: 'string' },
          thumbnail: { type: 'string' }
        }
      }
    }
  }, async (request) => {
    const { userId } = request.params as { userId: string };
    const { channelId, title, handle, thumbnail } = request.body as {
      channelId: string;
      title?: string;
      handle?: string;
      thumbnail?: string;
    };

    let finalTitle = title;
    let finalHandle = handle;
    let finalThumbnail = thumbnail;

    // Only fetch from YouTube if we're missing basic info
    if (!finalTitle || !finalThumbnail) {
      try {
        const channel = await ChannelService.getChannelDetails(channelId);
        finalTitle = finalTitle || channel.name;
        finalHandle = finalHandle || channel.handle;
        finalThumbnail = finalThumbnail || channel.thumbnail;
      } catch (err) {
        console.warn(`[user.routes] Could not fetch channel details for ${channelId}:`, err);
        finalTitle = finalTitle || channelId;
      }
    }

    const subscription = await UserDataService.upsertSubscription(userId, {
      channelId,
      title: finalTitle || channelId,
      handle: finalHandle || '',
      thumbnail: finalThumbnail || '',
      rssUrl: `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
    });

    return {
      success: true,
      item: subscription
    };
  });

  fastify.post('/:userId/subscriptions/batch', {
    schema: {
      ...baseUserSchema('Batch Subscribe To Channels', 'Adds multiple channel subscriptions in local storage.'),
      params: {
        type: 'object',
        required: ['userId'],
        properties: {
          userId: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        required: ['items'],
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              required: ['channelId'],
              properties: {
                channelId: { type: 'string' },
                title: { type: 'string' },
                handle: { type: 'string' },
                thumbnail: { type: 'string' }
              }
            }
          }
        }
      }
    }
  }, async (request) => {
    const { userId } = request.params as { userId: string };
    const { items } = request.body as {
      items: {
        channelId: string;
        title?: string;
        handle?: string;
        thumbnail?: string;
      }[];
    };

    const subscriptions = await UserDataService.upsertSubscriptions(userId, items.map(item => ({
      channelId: item.channelId,
      title: item.title || item.channelId,
      handle: item.handle || '',
      thumbnail: item.thumbnail || '',
      rssUrl: `https://www.youtube.com/feeds/videos.xml?channel_id=${item.channelId}`
    })));

    return {
      success: true,
      count: subscriptions.length
    };
  });

  fastify.delete('/:userId/subscriptions/:channelId', {
    schema: {
      ...baseUserSchema('Unsubscribe From Channel', 'Removes a channel subscription from local storage.'),
      params: {
        type: 'object',
        required: ['userId', 'channelId'],
        properties: {
          userId: { type: 'string' },
          channelId: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const { userId, channelId } = request.params as { userId: string; channelId: string };
    const removed = await UserDataService.removeSubscription(userId, channelId);

    if (!removed) {
      return reply.status(404).send({ error: 'Subscription not found' });
    }

    return { success: true };
  });

  fastify.get('/:userId/feed', {
    schema: {
      ...baseUserSchema('Get Subscription Feed', 'Aggregates the latest uploaded videos across subscribed channels.'),
      params: {
        type: 'object',
        required: ['userId'],
        properties: {
          userId: { type: 'string' }
        }
      },
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
          offset: { type: 'integer', minimum: 0, default: 0 }
        }
      }
    }
  }, async (request) => {
    const { userId } = request.params as { userId: string };
    const query = request.query as { limit?: number; offset?: number };
    const limit = Number(query.limit || 50);
    const offset = Number(query.offset || 0);
    const subscriptions = await UserDataService.listSubscriptions(userId);
    const items = await ChannelService.getSubscriptionFeed(subscriptions.map((item) => item.channelId), limit, offset);

    return {
      userId,
      subscriptions: subscriptions.length,
      items
    };
  });

  fastify.get('/:userId/rss', {
    schema: {
      ...baseUserSchema('Get Subscription RSS', 'Returns a combined RSS feed for subscribed channels.'),
      params: {
        type: 'object',
        required: ['userId'],
        properties: {
          userId: { type: 'string' }
        }
      },
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 }
        }
      }
    }
  }, async (request, reply) => {
    const { userId } = request.params as { userId: string };
    const limit = Number((request.query as { limit?: number })?.limit || 50);
    const subscriptions = await UserDataService.listSubscriptions(userId);
    const items = await ChannelService.getSubscriptionFeed(subscriptions.map((item) => item.channelId), limit);
    const xml = ChannelService.buildSubscriptionFeedXmlDocument(
      `${userId} subscriptions`,
      `/api/user/${encodeURIComponent(userId)}/rss`,
      items
    );

    reply.header('Content-Type', 'application/rss+xml; charset=utf-8');
    reply.send(xml);
  });
}
