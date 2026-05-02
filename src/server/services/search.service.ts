import { getYouTube } from '../lib/youtube.js';
import { SearchTrack, SearchCollection, VideoSummary, YouTubeClientType, SearchVideosPayload } from '../lib/types.js';
import { YouTubeService } from './youtube.service.js';
import { stringifyText, upgradeThumbnail, enforceCacheLimit } from '../lib/youtube.utils.js';

const searchCache = new Map<string, { data: SearchTrack[], timestamp: number }>();
const collectionSearchCache = new Map<string, { data: SearchCollection[], timestamp: number }>();
const videoSearchCache = new Map<string, { data: VideoSummary[], timestamp: number }>();
const searchSuggestionCache = new Map<string, { data: string[], timestamp: number }>();
const artistCache = new Map<string, { data: any, timestamp: number }>();

export class SearchService {
  private static CACHE_TTL_SEARCH = 10 * 60 * 1000;
  private static CACHE_TTL_SUGGESTIONS = 30 * 60 * 1000;
  private static CACHE_TTL_VIDEO_SEARCH = 10 * 60 * 1000;

  static async searchTracks(query: string): Promise<SearchTrack[]> {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) return [];

    const cached = searchCache.get(normalizedQuery);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_SEARCH) {
      return cached.data;
    }

    try {
      const yt = await getYouTube('WEB');
      const search = await yt.music.search(normalizedQuery, { type: 'song' });
      
      // YTMusic.Search.songs contains the song results
      const results = search.songs?.contents || (search as any).results || (search as any).contents || [];
      const tracks = this.extractTracks(results);

      searchCache.set(normalizedQuery, { data: tracks, timestamp: Date.now() });
      return tracks;
    } catch (e) {
      console.error('[SearchService] searchTracks failed:', e);
      return [];
    }
  }

  static async searchCollections(query: string, type: 'album' | 'playlist'): Promise<SearchCollection[]> {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) return [];

    const cacheKey = `${type}:${normalizedQuery.toLowerCase()}`;
    const cached = collectionSearchCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_SEARCH) {
      return cached.data;
    }

    try {
      const yt = await getYouTube('WEB');
      const results = await yt.music.search(normalizedQuery, { type });
      
      const collectionPayload = type === 'album' ? results.albums?.contents : results.playlists?.contents;
      const collections = this.extractCollections(collectionPayload || (results as any).results || (results as any).contents || []).slice(0, 60);

      collectionSearchCache.set(cacheKey, { data: collections, timestamp: Date.now() });
      return collections;
    } catch (e) {
      console.error('[SearchService] searchCollections failed:', e);
      return [];
    }
  }

  static async searchVideos(query: string, filters?: any, continuation?: string): Promise<SearchVideosPayload> {
    const normalizedQuery = query.trim();
    if (!normalizedQuery && !continuation) return { items: [] };

    const cacheKey = continuation ? `cont:${continuation}` : (filters ? `${normalizedQuery}:${JSON.stringify(filters)}` : normalizedQuery);
    const cached = videoSearchCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_VIDEO_SEARCH) {
      return { items: cached.data as VideoSummary[], continuation: (cached as any).continuation };
    }

    try {
      const yt = await getYouTube('WEB');
      let search: any;

      if (continuation) {
        // Use the continuation token to get the next page
        search = await (yt as any).getContinuation({ continuation } as any);
      } else {
        const searchOptions: any = { ...filters };
        if (filters?.type) {
          searchOptions.type = filters.type;
          delete searchOptions.type;
        }
        search = await yt.search(normalizedQuery, searchOptions);
      }

      // search.results (YT.Search) or search.contents (Continuation)
      const results = search.results || search.videos || search.contents || [];
      const videos = (results as any[])
        .map((item: any) => YouTubeService.normalizeVideoItem(item))
        .filter(Boolean) as VideoSummary[];

      // In youtubei.js, continuation is available on the search object
      const nextContinuation = search.continuation || undefined;
      
      videoSearchCache.set(cacheKey, { data: videos, timestamp: Date.now(), continuation: nextContinuation } as any);
      return { items: videos, continuation: nextContinuation };
    } catch (e) {
      console.error('[SearchService] searchVideos failed:', e);
      // Fallback for continuation if getContinuation fails
      if (continuation) {
        try {
          const yt = await getYouTube('WEB');
          const res = await (yt as any).actions.execute('/search', { continuation });
          const items = YouTubeService.extractVideos(res);
          return { items, continuation: res.continuation };
        } catch (inner) {
          console.error('[SearchService] Fallback searchVideos failed:', inner);
        }
      }
      return { items: [] };
    }
  }

  static async getSearchSuggestions(query: string): Promise<string[]> {
    const cached = searchSuggestionCache.get(query);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_SUGGESTIONS) {
      return cached.data;
    }

    try {
      const yt = await getYouTube('WEB');
      const suggestions = await yt.music.getSearchSuggestions(query);
      const mapped = suggestions.map((s: any) => s.text || s.toString());
      searchSuggestionCache.set(query, { data: mapped, timestamp: Date.now() });
      return mapped;
    } catch (e) {
      console.error('[SearchService] getSearchSuggestions failed:', e);
      return [];
    }
  }

  static async getArtist(artistId: string): Promise<any> {
    const cached = artistCache.get(artistId);
    if (cached && Date.now() - cached.timestamp < 30 * 60 * 1000) {
      return cached.data;
    }

    try {
      const yt = await getYouTube('WEB');
      const artist = await yt.music.getArtist(artistId) as any;
      
      const payload = {
        id: artistId,
        name: artist.name || '',
        thumbnail: YouTubeService.getThumbnailUrl(artist),
        description: artist.description || '',
        subscribers: artist.subscribers || '',
        sections: YouTubeService.extractRelatedSections(artist.sections)
      };

      enforceCacheLimit(artistCache, 100);
      artistCache.set(artistId, { data: payload, timestamp: Date.now() });
      return payload;
    } catch (e) {
      console.error('[SearchService] getArtist failed:', e);
      throw e;
    }
  }

  static async getHashtag(tag: string, continuation?: string): Promise<any> {
    const cacheKey = continuation ? `hashtag:${tag}:cont:${continuation}` : `hashtag:${tag}`;
    const cached = videoSearchCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_VIDEO_SEARCH) {
      return { items: cached.data, continuation: (cached as any).continuation, title: (cached as any).title };
    }

    try {
      const yt = await getYouTube('WEB');
      let feed: any;

      if (continuation) {
        feed = await (yt as any).getContinuation({ continuation } as any);
      } else {
        feed = await yt.getHashtag(tag);
      }

      const results = feed.videos || feed.contents?.contents || feed.contents || [];
      const videos = (results as any[])
        .map((item: any) => YouTubeService.normalizeVideoItem(item))
        .filter(Boolean) as VideoSummary[];
      
      const nextContinuation = feed.continuation || undefined;
      const title = stringifyText(feed.header?.title) || stringifyText(feed.title) || `#${tag}`;

      const payload = {
        title,
        items: videos,
        continuation: nextContinuation
      };

      videoSearchCache.set(cacheKey, { data: videos, timestamp: Date.now(), continuation: nextContinuation, title } as any);
      return payload;
    } catch (e) {
      console.error('[SearchService] getHashtag failed:', e);
      throw e;
    }
  }

  // --- Normalization Helpers ---

  private static extractTracks(payload: any): SearchTrack[] {
    const tracks: SearchTrack[] = [];
    const seenTracks = new Set<string>();
    
    const visit = (value: any) => {
      if (!value || typeof value !== 'object') return;
      const normalized = this.normalizeSearchTrack(value);
      if (normalized && !seenTracks.has(normalized.id)) {
        seenTracks.add(normalized.id);
        tracks.push(normalized);
        return;
      }
      if (Array.isArray(value)) {
        value.forEach(visit);
      } else {
        Object.values(value).forEach(visit);
      }
    };
    visit(payload);
    return tracks;
  }

  private static normalizeSearchTrack(candidate: any): SearchTrack | null {
    const id = candidate?.videoId || candidate?.endpoint?.payload?.videoId || candidate?.id;
    if (typeof id !== 'string' || !id) return null;

    let title = stringifyText(candidate?.title) || candidate?.name?.text || candidate?.name || '';
    const artist = candidate?.author?.name || candidate?.artists?.[0]?.name || 'Unknown Artist';
    
    // Clean up title: "Song / Artist" -> "Song"
    if (title.includes(' / ')) {
      const parts = title.split(' / ');
      if (parts[1]?.trim().toLowerCase() === artist.toLowerCase()) {
        title = parts[0].trim();
      }
    } else if (title.includes(' - ')) {
      const parts = title.split(' - ');
      if (parts[1]?.trim().toLowerCase() === artist.toLowerCase()) {
        title = parts[0].trim();
      }
    }

    const artistId = candidate?.author?.id || candidate?.artists?.[0]?.id || null;

    return {
      id,
      title,
      artist,
      artistId,
      thumbnail: YouTubeService.getThumbnailUrl(candidate),
      duration: candidate?.duration?.text || candidate?.length?.text || ''
    };
  }

  private static extractCollections(payload: any): SearchCollection[] {
    const items: SearchCollection[] = [];
    const seen = new Set<string>();

    const visit = (value: any) => {
      if (!value || typeof value !== 'object') return;
      const normalized = this.normalizeCollection(value);
      if (normalized && !seen.has(normalized.id)) {
        seen.add(normalized.id);
        items.push(normalized);
        return;
      }
      if (Array.isArray(value)) {
        value.forEach(visit);
      } else {
        Object.values(value).forEach(visit);
      }
    };
    visit(payload);
    return items;
  }

  private static normalizeCollection(candidate: any): SearchCollection | null {
    const type = this.inferCollectionType(candidate);
    if (!type) return null;

    const id = candidate?.id || candidate?.playlistId || candidate?.endpoint?.payload?.browseId;
    const title = stringifyText(candidate?.title) || stringifyText(candidate?.name);
    if (typeof id !== 'string' || !id || !title) return null;

    return {
      id,
      title,
      type,
      artist: candidate?.author?.name || candidate?.artists?.[0]?.name || null,
      artistId: candidate?.author?.id || candidate?.artists?.[0]?.id || null,
      thumbnail: YouTubeService.getThumbnailUrl(candidate),
      subtitle: stringifyText(candidate?.subtitle),
      year: `${candidate?.year || ''}`,
      itemCount: `${candidate?.item_count || candidate?.song_count || ''}`
    };
  }

  private static inferCollectionType(candidate: any): 'album' | 'single' | 'playlist' | null {
    const id = `${candidate?.id || candidate?.playlistId || candidate?.endpoint?.payload?.browseId || ''}`;
    if (id.startsWith('VL') || id.startsWith('PL')) return 'playlist';
    const subtitle = stringifyText(candidate?.subtitle).toLowerCase();
    if (subtitle.includes('album')) return 'album';
    if (subtitle.includes('single') || subtitle.includes('ep')) return 'single';
    return null;
  }
}
