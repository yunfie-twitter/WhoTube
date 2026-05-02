import { getYouTube } from '../lib/youtube.js';
import { VideoDetailsPayload, ManifestPayload, RelatedPayload, LyricsPayload, YouTubeClientType } from '../lib/types.js';
import { YouTubeService } from './youtube.service.js';
import { 
  stringifyText, upgradeThumbnail, enforceCacheLimit, 
  fetchItunesArtwork, cleanTrackText, parseDurationSeconds, 
  scoreLyricsCandidate, pickBestLyricsCandidate, buildLyricsPayload 
} from '../lib/youtube.utils.js';
import { Utils } from 'youtubei.js';

const videoDetailsCache = new Map<string, { data: VideoDetailsPayload, timestamp: number }>();
const metadataCache = new Map<string, { data: ManifestPayload['metadata'], timestamp: number }>();
const relatedCache = new Map<string, { data: RelatedPayload, timestamp: number }>();
const lyricsCache = new Map<string, { data: LyricsPayload, timestamp: number }>();

export class VideoService {
  private static CACHE_TTL_VIDEO_DETAILS = 60 * 60 * 1000;
  private static CACHE_TTL_METADATA = 24 * 60 * 60 * 1000;
  private static CACHE_TTL_RELATED = 60 * 60 * 1000;
  private static CACHE_TTL_LYRICS = 7 * 24 * 60 * 60 * 1000;
  
  private static MIN_SYNC_CONFIDENCE = 0.8;

  static async getVideoDetails(videoId: string): Promise<VideoDetailsPayload> {
    const cached = videoDetailsCache.get(videoId);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_VIDEO_DETAILS) {
      return cached.data;
    }

    try {
      const yt = await getYouTube('WEB');
      const info = await yt.getInfo(videoId);
      
      const basic = info.basic_info || {};
      const primaryInfo = info.primary_info || {};
      const secondaryInfo = info.secondary_info || {};
      
      const payload: VideoDetailsPayload = {
        id: videoId,
        title: stringifyText((primaryInfo as any)?.title?.original_text) || (basic as any).title || stringifyText((primaryInfo as any)?.title) || stringifyText((info as any).player_overlays?.autoplay?.title) || 'Unknown',
        description: info.secondary_info?.description?.toString() || basic.short_description || '',
        thumbnail: upgradeThumbnail((basic as any).thumbnail?.at?.(-1)?.url || (basic as any).thumbnail?.[0]?.url || (info as any).player_overlays?.autoplay?.thumbnail?.at?.(-1)?.url || (info as any).player_overlays?.autoplay?.thumbnail?.[0]?.url || ''),
        duration: basic.duration ? `${Math.floor(basic.duration / 60)}:${(basic.duration % 60).toString().padStart(2, '0')}` : '',
        durationSeconds: Number(basic.duration) || 0,
        viewCount: Number(basic.view_count || 0),
        likeCount: null,
        published: stringifyText((primaryInfo as any)?.date_text) || stringifyText((primaryInfo as any)?.published) || '',
        category: '',
        tags: Array.isArray((basic as any).keywords) ? (basic as any).keywords : [],
        author: (basic as any).author || stringifyText((secondaryInfo as any)?.owner?.name) || stringifyText((secondaryInfo as any)?.owner?.title) || 'Unknown',
        authorId: (basic as any).channel_id || (secondaryInfo as any)?.owner?.id || null,
        authorUrl: (basic as any).channel_id ? `https://www.youtube.com/channel/${(basic as any).channel_id}` : ((secondaryInfo as any)?.owner?.id ? `https://www.youtube.com/channel/${(secondaryInfo as any)?.owner?.id}` : null),
        authorThumbnail: (secondaryInfo as any)?.owner?.thumbnails?.at?.(-1)?.url || (secondaryInfo as any)?.owner?.thumbnail?.at?.(-1)?.url || (secondaryInfo as any)?.owner?.thumbnails?.[0]?.url || '',
        authorSubscriberCount: stringifyText((secondaryInfo as any)?.owner?.subscriber_count) || '',
        isLive: Boolean(basic.is_live),
        isUpcoming: false,
        recommendations: YouTubeService.extractVideos((info as any).watch_next_feed || (info as any).contents)
      };

      enforceCacheLimit(videoDetailsCache, 100);
      videoDetailsCache.set(videoId, { data: payload, timestamp: Date.now() });
      return payload;
    } catch (e) {
      console.error('[VideoService] getVideoDetails failed:', e);
      throw e;
    }
  }

  static async getMetadata(videoId: string, ytInstance?: any) {
    const cached = metadataCache.get(videoId);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_METADATA) {
      return cached.data;
    }

    try {
      const yt = ytInstance || await getYouTube('WEB');
      const info = await YouTubeService.getPlaybackInfo(videoId, 'WEB', yt);
      return await this.metadataFromBasicInfo(videoId, info.info.basic_info || {});
    } catch (e) {
      const fallback = { id: videoId, title: 'Unknown', artist: 'Unknown', artistId: null, thumbnail: '', duration: '' };
      metadataCache.set(videoId, { data: fallback, timestamp: Date.now() });
      return fallback;
    }
  }

  static async metadataFromBasicInfo(videoId: string, basic: any): Promise<ManifestPayload['metadata']> {
    const cached = metadataCache.get(videoId);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_METADATA) {
      return cached.data;
    }

    const title = basic?.title || '';
    const artist = basic?.author || basic?.channel?.name || '';
    const artistId = basic?.channel_id || basic?.author?.id || basic?.channel?.id;
    const itunes = await fetchItunesArtwork(title, artist);
    const ytThumbnail = upgradeThumbnail(basic?.thumbnail?.at?.(-1)?.url || basic?.thumbnail?.[0]?.url || '');
    const isMV = title.toLowerCase().includes('mv') || title.toLowerCase().includes('music video') || title.toLowerCase().includes('official video');
    const thumbnail = (itunes && !isMV) ? itunes : (ytThumbnail || itunes || '');
    const durationSeconds = basic?.duration || 0;
    const durationText = durationSeconds ? `${Math.floor(durationSeconds / 60)}:${(durationSeconds % 60).toString().padStart(2, '0')}` : '';
    const metadata = { id: videoId, title, artist, artistId: artistId || null, thumbnail, duration: durationText };
    
    enforceCacheLimit(metadataCache, 1000);
    metadataCache.set(videoId, { data: metadata, timestamp: Date.now() });
    return metadata;
  }

  static async getRelated(videoId: string): Promise<RelatedPayload> {
    const cached = relatedCache.get(videoId);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_RELATED) {
      return cached.data;
    }

    try {
      const yt = await getYouTube('WEB');
      const related = await yt.music.getRelated(videoId);
      const payload: RelatedPayload = {
        id: videoId,
        sections: YouTubeService.extractRelatedSections(related)
      };
      enforceCacheLimit(relatedCache, 100);
      relatedCache.set(videoId, { data: payload, timestamp: Date.now() });
      return payload;
    } catch {
      const fallback: RelatedPayload = { id: videoId, sections: [] };
      relatedCache.set(videoId, { data: fallback, timestamp: Date.now() });
      return fallback;
    }
  }

  static async getLyrics(videoId: string): Promise<LyricsPayload> {
    const cached = lyricsCache.get(videoId);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_LYRICS) {
      return cached.data;
    }

    try {
      const yt = await getYouTube('WEB');
      const metadata = await this.getMetadata(videoId, yt);
      const cleanTitle = cleanTrackText(metadata.title || '');
      const cleanArtist = cleanTrackText(metadata.artist || '');
      const durationSec = parseDurationSeconds(metadata.duration);
      const expectedTrack = { title: cleanTitle, artist: cleanArtist, durationSec };

      const ytLyricsPromise = yt.music.getLyrics(videoId).catch(() => null);
      const lrclibGetUrl = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(cleanArtist)}&track_name=${encodeURIComponent(cleanTitle)}${durationSec ? `&duration=${durationSec}` : ''}`;
      const lrclibGetPromise = fetch(lrclibGetUrl).catch(() => null);
      const lrclibSearchPromise = fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(`${cleanArtist} ${cleanTitle}`)}`).catch(() => null);

      const [ytLyrics, lrcGetRes, lrcSearchRes] = await Promise.all([
        ytLyricsPromise,
        lrclibGetPromise,
        lrclibSearchPromise
      ]);

      if (lrcGetRes?.ok) {
        const data: any = await lrcGetRes.json();
        const directScore = scoreLyricsCandidate(data, expectedTrack);
        const payload = buildLyricsPayload({
          source: 'lrclib',
          syncedLyrics: directScore >= this.MIN_SYNC_CONFIDENCE ? data?.syncedLyrics : null,
          plainLyrics: data?.plainLyrics,
          durationSec,
          allowEstimate: true
        });
        if (payload.kind === 'timed' || payload.kind === 'plain') {
          lyricsCache.set(videoId, { data: payload, timestamp: Date.now() });
          return payload;
        }
      }

      if (lrcSearchRes?.ok) {
        const results: any[] = await lrcSearchRes.json();
        if (Array.isArray(results) && results.length > 0) {
          const bestSynced = pickBestLyricsCandidate(results, expectedTrack, true);
          const bestPlain = pickBestLyricsCandidate(results, expectedTrack, false);
          const payload = buildLyricsPayload({
            source: 'lrclib',
            syncedLyrics: bestSynced && bestSynced.score >= this.MIN_SYNC_CONFIDENCE ? bestSynced.candidate?.syncedLyrics || null : null,
            plainLyrics: bestPlain?.candidate?.plainLyrics || bestSynced?.candidate?.plainLyrics || null,
            durationSec,
            allowEstimate: true
          });
          if (payload.kind !== 'none') {
            lyricsCache.set(videoId, { data: payload, timestamp: Date.now() });
            return payload;
          }
        }
      }

      const youtubePlain = ytLyrics?.description?.toString() || null;
      const youtubePayload = buildLyricsPayload({
        source: 'youtube',
        plainLyrics: youtubePlain,
        durationSec,
        allowEstimate: true
      });
      if (youtubePayload.kind !== 'none') {
        lyricsCache.set(videoId, { data: youtubePayload, timestamp: Date.now() });
        return youtubePayload;
      }

      const emptyPayload = buildLyricsPayload({ source: 'none' });
      lyricsCache.set(videoId, { data: emptyPayload, timestamp: Date.now() });
      return emptyPayload;
    } catch (e) {
      console.error('Failed to fetch lyrics from YouTube:', e);
      const emptyPayload = buildLyricsPayload({ source: 'none' });
      lyricsCache.set(videoId, { data: emptyPayload, timestamp: Date.now() });
      return emptyPayload;
    }
  }
}
