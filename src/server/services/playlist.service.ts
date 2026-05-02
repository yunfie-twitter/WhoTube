import { getYouTube } from '../lib/youtube.js';
import { PlaylistPayload, AlbumPayload, PlaylistVideosPayload, VideoSummary, RelatedItem } from '../lib/types.js';
import { YouTubeService } from './youtube.service.js';
import { stringifyText, enforceCacheLimit, upgradeThumbnail, shuffleArray } from '../lib/youtube.utils.js';

const playlistCache = new Map<string, { data: PlaylistPayload, timestamp: number }>();
const albumCache = new Map<string, { data: AlbumPayload, timestamp: number }>();
const playlistVideosCache = new Map<string, { data: PlaylistVideosPayload, timestamp: number }>();
const feedCache = new Map<string, { data: PlaylistVideosPayload, timestamp: number }>();

export class PlaylistService {
  private static CACHE_TTL_PLAYLIST = 30 * 60 * 1000;
  private static CACHE_TTL_ALBUM = 60 * 60 * 1000;
  private static CACHE_TTL_PLAYLIST_VIDEOS = 10 * 60 * 1000;
  private static CACHE_TTL_FEED = 30 * 60 * 1000;

  private static TRENDING_PLAYLIST_ID = 'PLFgquLnL59alW3ElNjS72w86S5FuakLaW';
  private static POPULAR_PLAYLIST_ID = 'PLFgquLnL59alCl_adYt69osNwLl9K4viW';

  static async getPlaylist(playlistId: string): Promise<PlaylistPayload> {
    const cached = playlistCache.get(playlistId);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_PLAYLIST) {
      return cached.data;
    }

    try {
      const yt = await getYouTube('WEB');
      const playlist = await yt.music.getPlaylist(playlistId) as any;
      const title = stringifyText(playlist?.header?.title) || 'Playlist';
      const subtitle = stringifyText(playlist?.header?.subtitle) || stringifyText(playlist?.header?.second_subtitle);
      const description = stringifyText(playlist?.header?.description);
      const thumbnail = YouTubeService.getThumbnailUrl(playlist?.header) || YouTubeService.getThumbnailUrl(playlist);
      const tracks = YouTubeService.extractTracks(playlist?.items || playlist?.contents)
        .slice(0, 300)
        .map(v => ({
          id: v.id,
          title: v.title,
          artist: v.author,
          artistId: v.authorId,
          thumbnail: v.thumbnail,
          duration: v.duration
        }));
      let related: RelatedItem[] = [];

      try {
        const relatedShelf = await playlist.getRelated();
        related = YouTubeService.extractRelatedSections([relatedShelf]).flatMap((section: any) => section.items).slice(0, 60);
      } catch { }

      const payload: PlaylistPayload = {
        id: playlistId,
        title,
        type: 'playlist',
        subtitle,
        description,
        thumbnail,
        tracks,
        related
      };
      enforceCacheLimit(playlistCache, 100);
      playlistCache.set(playlistId, { data: payload, timestamp: Date.now() });
      return payload;
    } catch {
      const fallback: PlaylistPayload = {
        id: playlistId,
        title: 'Playlist',
        type: 'playlist',
        subtitle: '',
        description: '',
        thumbnail: '',
        tracks: [],
        related: []
      };
      playlistCache.set(playlistId, { data: fallback, timestamp: Date.now() });
      return fallback;
    }
  }

  static async getAlbum(albumId: string): Promise<AlbumPayload> {
    const cached = albumCache.get(albumId);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_ALBUM) {
      return cached.data;
    }

    try {
      const yt = await getYouTube('WEB');
      const album = await yt.music.getAlbum(albumId) as any;
      const title = stringifyText(album?.header?.title) || 'Album';
      const subtitle = stringifyText(album?.header?.subtitle) || stringifyText(album?.header?.second_subtitle);
      const description = stringifyText(album?.header?.description);
      const thumbnail = YouTubeService.getThumbnailUrl(album?.header) || YouTubeService.getThumbnailUrl(album);
      const { artist, artistId } = YouTubeService.extractArtistRef(album?.header);
      const normalizedType = subtitle.toLowerCase().includes('single') || subtitle.toLowerCase().includes('ep') ? 'single' : 'album';
      const tracks = YouTubeService.extractTracks(album?.contents)
        .slice(0, 300)
        .map(v => ({
          id: v.id,
          title: v.title,
          artist: v.author,
          artistId: v.authorId,
          thumbnail: v.thumbnail,
          duration: v.duration
        }));
      const related = YouTubeService.extractRelatedSections(album?.sections).flatMap((section: any) => section.items).slice(0, 60);
      const yearMatch = subtitle.match(/\b(19|20)\d{2}\b/);

      const payload: AlbumPayload = {
        id: albumId,
        title,
        type: normalizedType,
        artist: artist || 'Unknown Artist',
        artistId,
        subtitle,
        description,
        thumbnail,
        year: yearMatch?.[0] || '',
        tracks,
        related
      };
      enforceCacheLimit(albumCache, 100);
      albumCache.set(albumId, { data: payload, timestamp: Date.now() });
      return payload;
    } catch {
      const fallback: AlbumPayload = {
        id: albumId,
        title: 'Album',
        type: 'album',
        artist: 'Unknown Artist',
        artistId: null,
        subtitle: '',
        description: '',
        thumbnail: '',
        year: '',
        tracks: [],
        related: []
      };
      albumCache.set(albumId, { data: fallback, timestamp: Date.now() });
      return fallback;
    }
  }

  static async getPlaylistVideos(playlistId: string, offset = 0, limit = 100): Promise<PlaylistVideosPayload> {
    const safeOffset = Math.max(0, offset);
    const safeLimit = Math.max(1, Math.min(limit, 200));
    const cacheKey = `${playlistId}:${safeOffset}:${safeLimit}`;
    const cached = playlistVideosCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_PLAYLIST_VIDEOS) {
      return cached.data;
    }

    try {
      const yt = await getYouTube('WEB');
      let playlist: any;
      try {
        // Try music playlist first if it looks like one
        playlist = await yt.getPlaylist(playlistId);
      } catch (err: any) {
        if (err.message?.includes('does not exist')) {
           // Fallback or try music
           playlist = await yt.music.getPlaylist(playlistId);
        } else {
          throw err;
        }
      }

      let collected = (playlist.items || []).map((item: any) => this.normalizePlaylistVideo(item)).filter((item: VideoSummary | null): item is VideoSummary => Boolean(item));

      while (collected.length < safeOffset + safeLimit && playlist.has_continuation) {
        playlist = await playlist.getContinuation();
        const nextItems = (playlist.items || []).map((item: any) => this.normalizePlaylistVideo(item)).filter((item: VideoSummary | null): item is VideoSummary => Boolean(item));
        collected = collected.concat(nextItems);
      }

      const payload: PlaylistVideosPayload = {
        id: playlistId,
        title: playlist.info?.title || 'Playlist',
        description: stringifyText(playlist.info?.description),
        thumbnail: playlist.info?.thumbnails?.at?.(-1)?.url || '',
        author: playlist.info?.author?.name || '',
        authorId: playlist.info?.author?.id || null,
        totalItems: `${playlist.info?.total_items || collected.length}`,
        items: collected.slice(safeOffset, safeOffset + safeLimit),
        offset: safeOffset,
        limit: safeLimit,
        hasMore: collected.length > safeOffset + safeLimit || playlist.has_continuation
      };

      enforceCacheLimit(playlistVideosCache, 50);
      playlistVideosCache.set(cacheKey, { data: payload, timestamp: Date.now() });
      return payload;
    } catch (e) {
      console.error('[PlaylistService] getPlaylistVideos failed:', e);
      throw e;
    }
  }

  static async getFeaturedFeed(kind: 'trending' | 'popular', offset = 0, limit = 100, region?: string): Promise<PlaylistVideosPayload> {
    const safeOffset = Math.max(0, offset);
    const safeLimit = Math.max(1, Math.min(limit, 200));
    
    // 全リストのキャッシュキー
    const fullListCacheKey = `full:${kind}:${region || 'default'}`;
    const cachedFull = feedCache.get(fullListCacheKey);
    
    let items: VideoSummary[] = [];
    if (cachedFull && Date.now() - cachedFull.timestamp < this.CACHE_TTL_FEED) {
      items = cachedFull.data.items;
    } else {
      try {
        const yt = await getYouTube('WEB');
        let fetchedItems: VideoSummary[] = [];

        if (kind === 'trending' && (!region || region === 'JP')) {
          try {
            const trending = await (yt as any).getTrending();
            fetchedItems = YouTubeService.extractVideos(trending.videos || trending.contents || trending)
              .filter(v => v.type === 'video');
          } catch (e) {
            console.warn('[PlaylistService] getTrending failed, falling back to search:', e);
          }
        }

        if (fetchedItems.length === 0) {
          const searchRegion = region || 'JP';
          const query = kind === 'trending' ? `${searchRegion} trending videos` : `${searchRegion} popular videos`;
          const searchResults = await (yt as any).search(query, { type: 'video' });
          fetchedItems = YouTubeService.extractVideos((searchResults as any).videos || (searchResults as any).contents)
            .filter(v => v.type === 'video');
        }

        // ランダム化向上のため、30分ごとのシードを使用してシャッフル
        if (fetchedItems.length > 0) {
          const seed = Math.floor(Date.now() / (30 * 60 * 1000));
          items = shuffleArray(fetchedItems, seed);
        } else {
          items = [];
        }

        // 全リストをキャッシュに保存
        const fullPayload: PlaylistVideosPayload = {
          id: kind,
          title: kind === 'trending' ? '急上昇' : '人気',
          description: '',
          thumbnail: '',
          author: 'YouTube',
          authorId: null,
          totalItems: String(items.length),
          items: items,
          offset: 0,
          limit: items.length,
          hasMore: false
        };
        enforceCacheLimit(feedCache, 20);
        feedCache.set(fullListCacheKey, { data: fullPayload, timestamp: Date.now() });
      } catch (e) {
        console.error(`[PlaylistService] getFeaturedFeed (${kind}) fetch failed:`, e);
        // エラー時は空リストを返す
        items = [];
      }
    }

    // スライスして返却
    const slicedItems = items.slice(safeOffset, safeOffset + safeLimit);
    
    return {
      id: kind,
      title: kind === 'trending' ? '急上昇' : '人気',
      description: '',
      thumbnail: '',
      author: 'YouTube',
      authorId: null,
      totalItems: String(items.length),
      items: slicedItems,
      offset: safeOffset,
      limit: safeLimit,
      hasMore: items.length > safeOffset + safeLimit
    };
  }

  private static normalizePlaylistVideo(item: any): VideoSummary | null {
    return YouTubeService.normalizeVideoItem(item);
  }
}
