import { FastifyInstance } from 'fastify';
import { YouTubeService } from '../services/youtube.service.js';
import { VideoService } from '../services/video.service.js';
import { SearchService } from '../services/search.service.js';
import { ChannelService } from '../services/channel.service.js';
import { PlaylistService } from '../services/playlist.service.js';
import { CommentService } from '../services/comment.service.js';
import { CaptionService } from '../services/caption.service.js';
import { getYouTube } from '../lib/youtube.js';
import { InvidiousUtils } from '../lib/invidious.utils.js';

export async function invidiousRoutes(fastify: FastifyInstance) {
  // GET /api/v1/stats
  fastify.get('/stats', async () => {
    return {
      version: "2.4.1",
      software: {
        name: "invidious",
        version: "2.4.1",
        branch: "master"
      },
      openRegistrations: true,
      usage: {
        users: {
          total: 100,
          activeHalfyear: 50,
          activeMonth: 20
        }
      },
      metadata: {
        updatedAt: Math.floor(Date.now() / 1000),
        lastChannelRefreshedAt: Math.floor(Date.now() / 1000)
      }
    };
  });

  // GET /api/v1/annotations/:id
  fastify.get('/annotations/:id', async () => {
    // YouTube annotations are mostly dead, return empty XML for now
    return "<?xml version=\"1.0\" encoding=\"UTF-8\"?><document></document>";
  });

  // GET /api/v1/clips
  fastify.get('/clips', async (req: any) => {
    const id = req.query.id;
    // Basic placeholder for clips
    return {
      startTime: 0,
      endTime: 60,
      clipTitle: "Clip",
      video: {}
    };
  });

  // GET /api/v1/videos/:id
  fastify.get('/videos/:id', async (req: any) => {
    const videoId = req.params.id;
    const details = await VideoService.getVideoDetails(videoId);
    const playback = await YouTubeService.getPlaybackInfo(videoId);
    const manifests = await YouTubeService.normalizeManifestStream(videoId, playback.info.streaming_data || {}, 'WEB'); // This is a bit complex as normalizeManifestStream expects a single format

    // Actually, we need to convert all streams
    const streamingData = playback.info.streaming_data || {};
    const adaptiveFormats = (streamingData.adaptive_formats || []).map((f: any) => InvidiousUtils.toAdaptiveFormat(f));
    const formatStreams = (streamingData.formats || []).map((f: any) => ({
      url: f.url,
      itag: String(f.itag),
      type: f.mimeType,
      quality: f.quality,
      container: f.container,
      encoding: f.codecs,
      qualityLabel: f.qualityLabel,
      resolution: f.width && f.height ? `${f.width}x${f.height}` : '',
      size: String(f.contentLength || '')
    }));

    const result: any = InvidiousUtils.toVideoObject(details);
    result.adaptiveFormats = adaptiveFormats;
    result.formatStreams = formatStreams;
    result.dashUrl = streamingData.dash_manifest_url || '';
    result.hlsUrl = streamingData.hls_manifest_url || '';
    
    // Captions
    try {
        const captionsPayload = await CaptionService.getCaptions(videoId);
        result.captions = (captionsPayload.tracks || []).map(t => ({
            label: t.label,
            language_code: t.languageCode,
            url: t.baseUrl
        }));
    } catch {
        result.captions = [];
    }
    
    // Recommendations
    result.recommendedVideos = (details.recommendations || []).map(v => {
        const obj = InvidiousUtils.toVideoObject(v);
        return {
            ...obj,
            authorVerified: false,
            viewCount: parseInt(v.viewCount?.replace(/[^0-9]/g, '') || '0'),
            viewCountText: v.viewCount
        };
    });

    return result;
  });

  // GET /api/v1/trending
  fastify.get('/trending', async (req: any) => {
    const region = req.query?.region || 'US';
    const videos = await PlaylistService.getFeaturedFeed('trending', 0, 100, region);
    return (videos.items as any[]).map(v => InvidiousUtils.toVideoObject(v));
  });

  // GET /api/v1/popular
  fastify.get('/popular', async () => {
    const videos = await PlaylistService.getFeaturedFeed('popular', 0, 100);
    return (videos.items as any[]).map(v => ({
      ...InvidiousUtils.toVideoObject(v),
      type: 'shortVideo'
    }));
  });

  // GET /api/v1/search/suggestions
  fastify.get('/search/suggestions', async (req: any) => {
    const q = req.query.q || '';
    const suggestions = await SearchService.getSearchSuggestions(q);
    return {
      query: q,
      suggestions: suggestions
    };
  });

  // GET /api/v1/search
  fastify.get('/search', async (req: any) => {
    const { q, page, sort, date, duration, type, features, region } = req.query;
    const filters: any = { sort_by: sort, period: date, duration, type };
    if (features) filters.features = features.split(',');
    
    const results = await SearchService.searchVideos(q || '', filters);
    return results.items.map(item => {
      if (item.type === 'channel') {
        return {
          type: 'channel',
          author: item.author,
          authorId: item.id,
          authorUrl: `/channel/${item.id}`,
          authorThumbnails: InvidiousUtils.toInvidiousThumbnail(item.thumbnail),
          autoGenerated: false,
          subCount: parseInt(item.viewCount?.replace(/[^0-9]/g, '') || '0'),
          videoCount: 0,
          description: item.description,
          descriptionHtml: item.description
        };
      } else if (item.type === 'playlist') {
        return {
          type: 'playlist',
          title: item.title,
          playlistId: item.id,
          playlistThumbnail: item.thumbnail,
          author: item.author,
          authorId: item.authorId,
          authorUrl: `/channel/${item.authorId}`,
          authorVerified: false,
          videoCount: parseInt(item.viewCount?.replace(/[^0-9]/g, '') || '0'),
          videos: []
        };
      } else {
        return InvidiousUtils.toVideoObject(item);
      }
    });
  });

  // GET /api/v1/comments/:id
  fastify.get('/comments/:id', async (req: any) => {
    const videoId = req.params.id;
    const sort = req.query.sort_by === 'new' ? 'NEWEST_FIRST' : 'TOP_COMMENTS';
    const commentsPayload = await CommentService.getComments(videoId, sort);
    
    return {
      commentCount: parseInt(commentsPayload.count || '0'),
      videoId: videoId,
      comments: (commentsPayload.comments || []).map(c => ({
        author: c.author,
        authorThumbnails: InvidiousUtils.toInvidiousThumbnail(c.authorThumbnail),
        authorId: c.authorId,
        authorUrl: c.authorUrl,
        isEdited: false,
        isPinned: c.isPinned,
        content: c.content,
        contentHtml: c.content,
        published: 0,
        publishedText: c.published,
        likeCount: parseInt(c.likeCount || '0'),
        commentId: c.id,
        authorIsChannelOwner: c.isOwner || false
      })),
      continuation: commentsPayload.continuation
    };
  });

  // GET /api/v1/channels/:id
  fastify.get('/channels/:id', async (req: any) => {
    const channelId = req.params.id;
    const details = await ChannelService.getChannelDetails(channelId);
    
    return {
      author: details.name,
      authorId: details.id,
      authorUrl: `/channel/${details.id}`,
      authorVerified: details.isVerified,
      authorBanners: [{ url: details.banner, width: 1500, height: 500 }],
      authorThumbnails: [{ url: details.thumbnail, width: 100, height: 100 }],
      subCount: parseInt(details.subscriberCount?.replace(/[^0-9]/g, '') || '0'),
      totalViews: parseInt(details.viewCount?.replace(/[^0-9]/g, '') || '0'),
      joined: 0,
      autoGenerated: false,
      isFamilyFriendly: true,
      description: details.description,
      descriptionHtml: details.description,
      allowedRegions: ['US'],
      tabs: ['videos', 'playlists', 'community'],
      latestVideos: (details.videos || []).map(v => InvidiousUtils.toVideoObject(v)),
      relatedChannels: []
    };
  });

  // GET /api/v1/channels/:id/videos
  fastify.get('/channels/:id/videos', async (req: any) => {
    const channelId = req.params.id;
    const details = await ChannelService.getChannelDetails(channelId); // Reusing details for now
    return {
      videos: (details.videos || []).map(v => InvidiousUtils.toVideoObject(v)),
      continuation: ""
    };
  });

  // GET /api/v1/channels/:ucid/search
  fastify.get('/channels/:ucid/search', async (req: any) => {
      const ucid = req.params.ucid;
      const q = req.query.q || '';
      const yt = await getYouTube('WEB');
      const channel = await yt.getChannel(ucid);
      const results = await channel.search(q);
      const items = YouTubeService.extractVideos((results as any).contents || (results as any).videos || results);
      return items.map(v => InvidiousUtils.toVideoObject(v));
  });

  // GET /api/v1/post/:id
  fastify.get('/post/:id', async (req: any) => {
      // YouTube community posts are complex, return placeholder for now
      return {
          authorId: req.params.id,
          comments: []
      };
  });

  // GET /api/v1/playlists/:plid
  fastify.get('/playlists/:plid', async (req: any) => {
    const playlistId = req.params.plid;
    const details = await PlaylistService.getPlaylistVideos(playlistId, 0, 100);
    
    return {
      title: details.title,
      playlistId: details.id,
      author: details.author,
      authorId: details.authorId,
      authorThumbnails: [],
      description: details.description,
      descriptionHtml: details.description,
      videoCount: parseInt(details.totalItems || '0'),
      viewCount: 0,
      updated: 0,
      videos: (details.items || []).map((v, i) => ({
        ...InvidiousUtils.toVideoObject(v),
        index: i
      }))
    };
  });

  // GET /api/v1/hashtag/:tag
  fastify.get('/hashtag/:tag', async (req: any) => {
    const tag = req.params.tag;
    const results = await SearchService.getHashtag(tag);
    return {
      results: (results.videos as any[]).map(v => InvidiousUtils.toVideoObject(v))
    };
  });

  // GET /api/v1/resolveurl
  fastify.get('/resolveurl', async (req: any) => {
      const url = req.query.url;
      if (!url) return { error: "URL is required" };
      
      const yt = await getYouTube('WEB');
      try {
          const resolved = await yt.resolveURL(url);
          // resolved is an endpoint object in youtubei.js
          const payload: any = { pageType: 'unknown' };
          
          const browseId = resolved.payload?.browseId;
          const videoId = resolved.payload?.videoId;
          const playlistId = resolved.payload?.playlistId;
          
          if (videoId) {
              payload.videoId = videoId;
              payload.pageType = 'video';
          } else if (playlistId) {
              payload.playlistId = playlistId;
              payload.pageType = 'playlist';
          } else if (browseId) {
              if (browseId.startsWith('UC')) {
                  payload.ucid = browseId;
                  payload.pageType = 'channel';
              } else {
                  payload.browseId = browseId;
              }
          }
          
          return payload;
      } catch (e) {
          return { pageType: 'unknown' };
      }
  });

  // GET /api/v1/mixes/:rdid
  fastify.get('/mixes/:rdid', async (req: any) => {
      const mixId = req.params.rdid;
      // Mixes are basically playlists in Invidious/YouTube
      const details = await PlaylistService.getPlaylistVideos(mixId, 0, 100);
      return {
          title: details.title,
          mixId: mixId,
          videos: (details.items || []).map((v, i) => ({
              ...InvidiousUtils.toVideoObject(v),
              index: i
          }))
      };
  });

  // GET /api/v1/captions/:id
  fastify.get('/captions/:id', async (req: any) => {
      const videoId = req.params.id;
      const captions = await CaptionService.getCaptions(videoId);
      return {
          captions: captions.tracks.map(t => ({
              label: t.label,
              languageCode: t.languageCode,
              url: t.baseUrl
          }))
      };
  });
}
