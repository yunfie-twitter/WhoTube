import { FastifyInstance } from 'fastify';
import { YouTubeService } from '../services/youtube.service.js';
import { SearchService } from '../services/search.service.js';
import { ChannelService } from '../services/channel.service.js';
import { PlaylistService } from '../services/playlist.service.js';
import { HomeService } from '../services/home.service.js';
import { CommentService } from '../services/comment.service.js';
import { VideoService } from '../services/video.service.js';
import { ManifestService } from '../services/manifest.service.js';
import { CaptionService } from '../services/caption.service.js';
import { ImageProxyHandler } from '../handlers/image.proxy.js';
import { MediaProxyHandler } from '../handlers/media.proxy.js';
import { ManifestProxyHandler } from '../handlers/manifest.proxy.js';
import { StreamProxyHandler } from '../handlers/stream.proxy.js';
import { config } from '../lib/config.js';

const idParamSchema = {
  type: 'object',
  required: ['id'],
  properties: {
    id: { type: 'string' }
  }
} as const;

const searchQuerySchema = {
  type: 'object',
  properties: {
    q: { type: 'string' },
    continuation: { type: 'string' }
  }
} as const;

const pagingQuerySchema = {
  type: 'object',
  properties: {
    offset: { type: 'integer', minimum: 0, default: 0 },
    limit: { type: 'integer', minimum: 1, maximum: 200, default: 100 },
    region: { type: 'string' }
  }
} as const;

function apiSchema(summary: string, description: string, extra: Record<string, unknown> = {}) {
  return {
    summary,
    description,
    tags: ['youtube'],
    ...extra
  };
}

export async function youtubeRoutes(fastify: FastifyInstance) {
  fastify.get('/config', {
    schema: {
      summary: 'Get App Configuration',
      description: 'Returns the application configuration for the client.',
      tags: ['youtube']
    }
  }, async () => {
    return {
      forcedSubscriptionChannelIds: config.meta.forcedSubscriptionChannelIds
    };
  });

  fastify.get('/search', {
    schema: apiSchema('Search Tracks', 'Searches YouTube Music tracks.', { querystring: searchQuerySchema })
  }, async (req: any) => {
    const { q } = req.query;
    return {
      query: q,
      items: await SearchService.searchTracks(q || '')
    };
  });

  fastify.get('/search/playlists', {
    schema: apiSchema('Search Playlists', 'Searches playlists.', { querystring: searchQuerySchema })
  }, async (req: any) => {
    const { q } = req.query;
    return {
      query: q,
      items: await SearchService.searchCollections(q || '', 'playlist')
    };
  });

  fastify.get('/search/albums', {
    schema: apiSchema('Search Albums', 'Searches albums.', { querystring: searchQuerySchema })
  }, async (req: any) => {
    const { q } = req.query;
    return {
      query: q,
      items: await SearchService.searchCollections(q || '', 'album')
    };
  });

  fastify.get('/search/videos', {
    schema: apiSchema('Search Videos', 'Searches standard YouTube videos.', { 
      querystring: {
        type: 'object',
        properties: {
          q: { type: 'string' },
          sort: { type: 'string' },
          period: { type: 'string' },
          duration: { type: 'string' },
          features: { type: 'string' },
          type: { type: 'string' },
          continuation: { type: 'string' }
        }
      }
    })
  }, async (req: any) => {
    const { q, sort, period, duration, features, type, continuation } = req.query;
    const filters: any = {};
    if (sort) filters.sort_by = sort;
    if (period) filters.period = period;
    if (duration) filters.duration = duration;
    if (type) filters.type = type;
    if (features) {
      filters.features = features.split(',');
    }
    
    return await SearchService.searchVideos(q || '', Object.keys(filters).length > 0 ? filters : undefined, continuation);
  });

  fastify.get('/search/suggestions', {
    schema: apiSchema('Search Suggestions', 'Returns search suggestion strings.', { querystring: searchQuerySchema })
  }, async (req: any) => {
    const { q } = req.query;
    return {
      query: q,
      items: await SearchService.getSearchSuggestions(q || '')
    };
  });

  fastify.get('/hashtag/:tag', {
    schema: apiSchema('Get Hashtag', 'Returns videos for a specific hashtag.', {
      params: {
        type: 'object',
        required: ['tag'],
        properties: {
          tag: { type: 'string' }
        }
      },
      querystring: {
        type: 'object',
        properties: {
          continuation: { type: 'string' }
        }
      }
    })
  }, async (req: any) => {
    const { tag } = req.params;
    const { continuation } = req.query;
    return await SearchService.getHashtag(tag, continuation);
  });

  fastify.get('/artist/:id', {
    schema: apiSchema('Get Artist', 'Returns artist details and top tracks.', { params: idParamSchema })
  }, async (req: any) => {
    const { id } = req.params;
    return await SearchService.getArtist(id);
  });

  fastify.get('/playlist/:id', {
    schema: apiSchema('Get Playlist', 'Returns playlist details.', { params: idParamSchema })
  }, async (req: any) => {
    const { id } = req.params;
    return await PlaylistService.getPlaylist(id);
  });

  fastify.get('/playlist/:id/videos', {
    schema: apiSchema('Get Playlist Videos', 'Returns playlist videos with offset/limit pagination.', {
      params: idParamSchema,
      querystring: pagingQuerySchema
    })
  }, async (req: any) => {
    const { id } = req.params;
    const offset = Number(req.query?.offset || 0);
    const limit = Number(req.query?.limit || 100);
    return await PlaylistService.getPlaylistVideos(id, offset, limit);
  });

  fastify.get('/album/:id', {
    schema: apiSchema('Get Album', 'Returns album details.', { params: idParamSchema })
  }, async (req: any) => {
    const { id } = req.params;
    return await PlaylistService.getAlbum(id);
  });

  fastify.get('/related/:id', {
    schema: apiSchema('Get Related', 'Returns related sections for a video.', { params: idParamSchema })
  }, async (req: any) => {
    const { id } = req.params;
    return await VideoService.getRelated(id);
  });

  fastify.get('/manifest/:id', {
    schema: apiSchema('Get Manifest', 'Returns a playable manifest proxy for a video.', { params: idParamSchema })
  }, async (req: any, reply) => {
    const { id } = req.params;
    const baseUrl = `${req.protocol}://${req.hostname}/api`;
    try {
      return await ManifestService.getManifest(id, baseUrl);
    } catch (e: any) {
      reply.status(500).send({ error: e.message });
    }
  });

  fastify.get('/metadata/:id', {
    schema: apiSchema('Get Metadata', 'Returns compact video metadata.', { params: idParamSchema })
  }, async (req: any) => {
    return await VideoService.getMetadata(req.params.id);
  });

  fastify.get('/video/:id', {
    schema: apiSchema('Get Video Details', 'Returns full video details plus recommendations.', { params: idParamSchema })
  }, async (req: any) => {
    return await VideoService.getVideoDetails(req.params.id);
  });

  fastify.get('/comments/:id', {
    schema: apiSchema('Get Comments', 'Returns comments for a video.', {
      params: idParamSchema,
      querystring: {
        type: 'object',
        properties: {
          sort: { type: 'string', enum: ['TOP_COMMENTS', 'NEWEST_FIRST'], default: 'TOP_COMMENTS' },
          continuation: { type: 'string' }
        }
      }
    })
  }, async (req: any) => {
    const { id } = req.params;
    const { sort, continuation } = req.query;
    return await CommentService.getComments(id, sort, continuation);
  });

  fastify.get('/comments/:id/replies/:commentId', {
    schema: apiSchema('Get Comment Replies', 'Returns replies for a top-level comment.', {
      params: {
        type: 'object',
        required: ['id', 'commentId'],
        properties: {
          id: { type: 'string' },
          commentId: { type: 'string' }
        }
      }
    })
  }, async (req: any) => {
    return await CommentService.getCommentReplies(req.params.id, req.params.commentId);
  });

  fastify.get('/channel/:id', {
    schema: apiSchema('Get Channel', 'Returns channel metadata and videos.', { params: idParamSchema })
  }, async (req: any) => {
    return await ChannelService.getChannelDetails(req.params.id);
  });

  fastify.get('/channel/:id/videos', {
    schema: apiSchema('Get Channel Videos', 'Returns videos for a channel.', { 
      params: idParamSchema,
      querystring: {
        type: 'object',
        properties: {
          continuation: { type: 'string' }
        }
      }
    })
  }, async (req: any) => {
    return await ChannelService.getChannelTab(req.params.id, 'videos', req.query?.continuation);
  });

  fastify.get('/channel/:id/shorts', {
    schema: apiSchema('Get Channel Shorts', 'Returns shorts for a channel.', { 
      params: idParamSchema,
      querystring: {
        type: 'object',
        properties: {
          continuation: { type: 'string' }
        }
      }
    })
  }, async (req: any) => {
    return await ChannelService.getChannelTab(req.params.id, 'shorts', req.query?.continuation);
  });

  fastify.get('/channel/:id/live', {
    schema: apiSchema('Get Channel Live Streams', 'Returns live streams for a channel.', { 
      params: idParamSchema,
      querystring: {
        type: 'object',
        properties: {
          continuation: { type: 'string' }
        }
      }
    })
  }, async (req: any) => {
    return await ChannelService.getChannelTab(req.params.id, 'live', req.query?.continuation);
  });

  fastify.get('/trending', {
    schema: apiSchema('Get Trending Feed', 'Returns the configured trending feed.', { querystring: pagingQuerySchema })
  }, async (req: any) => {
    const offset = Number(req.query?.offset || 0);
    const limit = Number(req.query?.limit || 100);
    const region = req.query?.region;
    return await PlaylistService.getFeaturedFeed('trending', offset, limit, region);
  });

  fastify.get('/popular', {
    schema: apiSchema('Get Popular Feed', 'Returns the configured popular feed.', { querystring: pagingQuerySchema })
  }, async (req: any) => {
    const offset = Number(req.query?.offset || 0);
    const limit = Number(req.query?.limit || 100);
    const region = req.query?.region;
    return await PlaylistService.getFeaturedFeed('popular', offset, limit, region);
  });

  fastify.get('/home/feed', {
    schema: apiSchema('Get Home Feed', 'Returns the YouTube Home feed with shelves.', {
      querystring: {
        type: 'object',
        properties: {
          continuation: { type: 'string' }
        }
      }
    })
  }, async (req: any) => {
    return await HomeService.getHomeFeed(req.query?.continuation);
  });

  fastify.get('/home/music/feed', {
    schema: apiSchema('Get Music Home Feed', 'Returns the YouTube Music Home feed with shelves.', {
      querystring: {
        type: 'object',
        properties: {
          continuation: { type: 'string' }
        }
      }
    })
  }, async (req: any) => {
    return await HomeService.getMusicHomeFeed(req.query?.continuation);
  });

  fastify.get('/captions/:id', {
    schema: apiSchema('Get Caption Tracks', 'Lists available caption tracks and translation languages.', { params: idParamSchema })
  }, async (req: any) => {
    return await CaptionService.getCaptions(req.params.id);
  });

  fastify.get('/captions/:id/download', {
    schema: apiSchema('Download Caption Track', 'Downloads a caption track in vtt, ttml, or json3 format.', {
      params: idParamSchema,
      querystring: {
        type: 'object',
        properties: {
          lang: { type: 'string' },
          tlang: { type: 'string' },
          format: { type: 'string', enum: ['vtt', 'ttml', 'json3'] }
        }
      }
    })
  }, async (req: any, reply) => {
    const format = req.query?.format === 'ttml' ? 'ttml' : req.query?.format === 'json3' ? 'json3' : 'vtt';
    const result = await CaptionService.downloadCaptionTrack(
      req.params.id,
      req.query?.lang,
      req.query?.tlang,
      format
    );

    reply.header('Content-Type', result.contentType);
    reply.send(result.body);
  });

  fastify.get('/transcript/:id', {
    schema: apiSchema('Get Transcript', 'Returns normalized transcript segments.', {
      params: idParamSchema,
      querystring: {
        type: 'object',
        properties: {
          lang: { type: 'string' },
          tlang: { type: 'string' }
        }
      }
    })
  }, async (req: any) => {
    return await CaptionService.getTranscript(req.params.id, req.query?.lang, req.query?.tlang);
  });

  fastify.get('/feed/channel/:id', {
    schema: apiSchema('Get Channel Feed', 'Returns parsed RSS entries for a channel.', {
      params: idParamSchema,
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 50, default: 15 }
        }
      }
    })
  }, async (req: any) => {
    const limit = Number(req.query?.limit || 15);
    return await ChannelService.getChannelFeed(req.params.id, limit);
  });

  fastify.get('/rss/channel/:id', {
    schema: apiSchema('Get Channel RSS', 'Returns the raw YouTube RSS XML feed for a channel.', {
      params: idParamSchema
    })
  }, async (req: any, reply) => {
    const xml = await ChannelService.getChannelFeedXml(req.params.id);
    reply.header('Content-Type', 'application/rss+xml; charset=utf-8');
    reply.send(xml);
  });
  
  fastify.get('/lyrics/:id', {
    schema: apiSchema('Get Lyrics', 'Returns lyrics or generated timing data.', { params: idParamSchema })
  }, async (req: any) => {
    return await VideoService.getLyrics(req.params.id);
  });

  // --- Proxies ---
  fastify.route({
    method: ['GET', 'HEAD'],
    url: '/proxy/image',
    schema: apiSchema('Proxy Image', 'Proxies remote thumbnails and avatars.', {
      querystring: {
        type: 'object',
        required: ['url'],
        properties: {
          url: { type: 'string' }
        }
      }
    }),
    handler: ImageProxyHandler.handleImage
  });

  fastify.route({
    method: ['GET', 'HEAD'],
    url: '/proxy/segment',
    schema: apiSchema('Proxy Media Segment', 'Proxies media segments for playback.', {
      querystring: {
        type: 'object',
        required: ['v', 'itag'],
        properties: {
          v: { type: 'string' },
          itag: { type: ['string', 'number'] },
          src: { type: 'string' }
        }
      }
    }),
    handler: MediaProxyHandler.handleSegment
  });
  
  fastify.route({
    method: ['GET', 'HEAD'],
    url: '/proxy/companion/videoplayback',
    schema: apiSchema('Proxy Companion Media', 'Proxies media segments from Companion API.', {
      querystring: {
        type: 'object',
        required: ['url'],
        properties: {
          url: { type: 'string' },
          v: { type: 'string' }
        }
      }
    }),
    handler: MediaProxyHandler.handleCompanionVideoplayback
  });

  fastify.route({
    method: ['GET', 'HEAD'],
    url: '/proxy/dash',
    schema: apiSchema('Proxy DASH Manifest', 'Proxies DASH manifest for MSE playback.', {
      querystring: {
        type: 'object',
        required: ['v'],
        properties: {
          v: { type: 'string' },
          codec: { type: 'string', enum: ['auto', 'av1', 'vp9', 'avc1'] }
        }
      }
    }),
    handler: ManifestProxyHandler.handleDashManifest
  });
  
  fastify.get('/proxy/dash/companion', {
    schema: apiSchema('Proxy Companion DASH', 'Proxies DASH manifest from Companion API.', {
      querystring: {
        type: 'object',
        required: ['v'],
        properties: {
          v: { type: 'string' }
        }
      }
    })
  }, ManifestProxyHandler.handleCompanionDashProxy);

  fastify.route({
    method: ['GET', 'HEAD'],
    url: '/proxy/hls',
    schema: apiSchema('Proxy HLS Manifest', 'Returns an HLS master playlist for adaptive playback.', {
      querystring: {
        type: 'object',
        required: ['v'],
        properties: {
          v: { type: 'string' },
          codec: { type: 'string', enum: ['auto', 'av1', 'vp9', 'avc1'] }
        }
      }
    }),
    handler: ManifestProxyHandler.handleHlsManifest
  });

  fastify.get('/proxy/hls/media', {
    schema: apiSchema('Proxy HLS Media Playlist', 'Returns an HLS media playlist for one adaptive stream.', {
      querystring: {
        type: 'object',
        required: ['v', 'type', 'itag'],
        properties: {
          v: { type: 'string' },
          type: { type: 'string' },
          itag: { type: ['string', 'number'] }
        }
      }
    })
  }, ManifestProxyHandler.handleHlsMediaPlaylist);

  fastify.get('/proxy/merge', {
    schema: apiSchema('Proxy Merged Stream', 'Merges video-only and audio-only into a single MP4 stream.', {
      querystring: {
        type: 'object',
        required: ['v', 'vItag', 'aItag'],
        properties: {
          v: { type: 'string' },
          vItag: { type: ['string', 'number'] },
          aItag: { type: ['string', 'number'] }
        }
      }
    })
  }, StreamProxyHandler.handleMergedStream);

  fastify.get('/proxy/video/:videoId', {
    schema: apiSchema('Proxy Best Video', 'Proxies best available muxed video+audio stream.', {
      params: {
        type: 'object',
        required: ['videoId'],
        properties: {
          videoId: { type: 'string' }
        }
      }
    })
  }, StreamProxyHandler.handleVideoProxy);
}
