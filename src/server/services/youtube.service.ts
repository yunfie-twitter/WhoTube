import { getYouTube, getYouTubeForPlayback, fetchPoToken, isYouTubeClientCoolingDown, coolDownYouTubeClient, removeYouTubeInstance, stableFetch, clearPoTokenCache } from '../lib/youtube.js';
import { xmlEscape, isoDuration, stringifyText, upgradeThumbnail, normalizeByteRange, hlsEscape } from '../lib/youtube.utils.js';
import { getCompanionBaseUrl } from '../lib/companion.js';
import { 
  YouTubeClientType, RelatedItem, RelatedSection, VideoSummary
} from '../lib/types.js';

const infoCache = new Map<string, { data: any, timestamp: number }>();
const videoBlockedClients = new Map<string, Set<YouTubeClientType>>();
const crippledCache = new Map<string, { timestamp: number }>();
const prefetchQueue = new Map<string, { data: Buffer, contentType: string, expiresAt: number }>();

import { config } from '../lib/config.js';

export class YouTubeService {
  private static CACHE_TTL_INFO = 5 * 60 * 1000;

  // --- Core Playback ---

  private static async fetchPlaybackInfoFromCompanion(videoId: string, client: YouTubeClientType): Promise<any | null> {
    try {
      const companionBaseUrl = getCompanionBaseUrl(videoId);
      const COMPANION_SECRET = config.companion.secret;

      const res = await stableFetch(`${companionBaseUrl}/youtubei/v1/player`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${COMPANION_SECRET}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ videoId })
      });
      if (!res.ok) return null;
      const playerData = await res.json() as any;
      
      const ustreamerConfig = playerData.playerConfig?.mediaCommonConfig?.mediaUstreamerRequestConfig?.videoPlaybackUstreamerRequestConfig?.videoPlaybackUstreamerConfig
          || playerData.playerConfig?.mediaCommonConfig?.mediaUstreamerRequestConfig?.videoPlaybackUstreamerConfig;

      return {
        streaming_data: YouTubeService.normalizePlayerStreamingData(playerData.streamingData, ustreamerConfig, videoId, client),
        basic_info: {
          id: playerData.videoDetails?.videoId,
          title: playerData.videoDetails?.title,
          duration: Number.parseInt(playerData.videoDetails?.lengthSeconds || '0'),
          channel_id: playerData.videoDetails?.channelId,
          author: playerData.videoDetails?.author,
          thumbnail: playerData.videoDetails?.thumbnail?.thumbnails?.map((t: any) => ({ url: t.url, width: t.width, height: t.height })),
          view_count: Number.parseInt(playerData.videoDetails?.viewCount || '0'),
          short_description: playerData.videoDetails?.shortDescription,
        },
        playability_status: playerData.playabilityStatus
      };
    } catch (e) {
      console.warn('[Companion] Playback info fetch failed:', e);
      return null;
    }
  }

  static async getPlaybackInfo(videoId: string, client: YouTubeClientType = 'WEB', ytInstance?: any, forceRefresh = false) {
    const key = `${videoId}-${client}`;
    const cached = infoCache.get(key);
    if (!forceRefresh && cached && Date.now() - cached.timestamp < YouTubeService.CACHE_TTL_INFO) return cached.data;

    // Companion Player API を最優先で試行 (ユーザー要求: APIを優先)
    const companionInfo = await YouTubeService.fetchPlaybackInfoFromCompanion(videoId, client);
    if (companionInfo) {
      infoCache.set(key, { data: companionInfo, timestamp: Date.now() });
      return companionInfo;
    }

    const clientsToTry: YouTubeClientType[] = [client, 'ANDROID', 'WEB_REMIX', 'WEB_SAFARI', 'WEB', 'ANDROID_VR', 'TV', 'MWEB'];
    const uniqueClients = [...new Set(clientsToTry)];
    let lastError = null;

    for (const targetClient of uniqueClients) {
      if (isYouTubeClientCoolingDown(targetClient) || YouTubeService.isVideoClientBlocked(videoId, targetClient)) continue;

      try {
        const { yt, pot } = await getYouTubeForPlayback(videoId, targetClient);
        const options: any = { 
          videoId,
          playbackContext: {
            contentPlaybackContext: {
              vis: 0,
              splay: false,
              lactMilliseconds: "-1",
              signatureTimestamp: yt.session.player?.signature_timestamp,
            },
          },
          racyCheckOk: true,
          contentCheckOk: true
        };
        if (pot?.poToken) {
          options.poToken = pot.poToken;
        }

        const response: any = await yt.actions.execute('/player', options);
        const playerData = response.data || response;
        if (!playerData) throw new Error('Empty response from /player');

        const ustreamerConfig = playerData.playerConfig?.mediaCommonConfig?.mediaUstreamerRequestConfig?.videoPlaybackUstreamerRequestConfig?.videoPlaybackUstreamerConfig
          || playerData.playerConfig?.mediaCommonConfig?.mediaUstreamerRequestConfig?.videoPlaybackUstreamerConfig;

        const data = {
          streaming_data: YouTubeService.normalizePlayerStreamingData(playerData.streamingData, ustreamerConfig, videoId, targetClient),
          basic_info: {
            id: playerData.videoDetails?.videoId,
            title: playerData.videoDetails?.title,
            duration: Number.parseInt(playerData.videoDetails?.lengthSeconds || '0'),
            author: playerData.videoDetails?.author,
            channel_id: playerData.videoDetails?.channelId,
            is_live: !!playerData.videoDetails?.isLive,
            thumbnail: playerData.videoDetails?.thumbnail?.thumbnails,
            short_description: playerData.videoDetails?.shortDescription,
            view_count: playerData.videoDetails?.viewCount
          },
          playability_status: playerData.playabilityStatus
        };

        if (data.playability_status?.status !== 'OK') {
          const reason = data.playability_status?.reason || '';
          console.warn(`[YouTubeService] Playability status for ${videoId} (${targetClient}): ${data.playability_status?.status} - ${reason}`);
        }

        if (data.playability_status?.status === 'UNPLAYABLE' || data.playability_status?.status === 'LOGIN_REQUIRED') {
          const reason = data.playability_status.reason || '';
          if (reason.includes('unavailable') || reason.includes('reloaded') || reason.includes('bot')) {
            YouTubeService.markVideoClientBlocked(videoId, targetClient);
            YouTubeService.refreshPlaybackPoToken(videoId, targetClient).catch(() => {});
          }
          throw new Error(`Video is unplayable (${data.playability_status.status}): ${reason}`);
        }
        const payload = { info: data, pot };
        infoCache.set(key, { data: payload, timestamp: Date.now() });
        return payload;
      } catch (error: any) {
        lastError = error;
        const message = error.message || '';
        if (message.includes('unavailable') || message.includes('reloaded') || message.includes('403') || message.includes('400')) {
          console.warn(`[YouTubeService] Failure for ${targetClient} on ${videoId}. Purging instance and tokens.`);
          removeYouTubeInstance(targetClient);
          YouTubeService.refreshPlaybackPoToken(videoId, targetClient).catch(() => {});
        }
      }
    }

    throw lastError || new Error(`All clients failed to get playback info for ${videoId}`);
  }

  static async refreshPlaybackPoToken(videoId: string, client: YouTubeClientType) {
    console.log(`[YouTubeService] Refreshing PoToken for ${videoId} (${client})...`);
    clearPoTokenCache(videoId, client);
    await fetchPoToken(videoId, client);
  }

  static isCrippled(videoId: string, client: string): boolean {
    return crippledCache.has(`${videoId}-${client}`);
  }

  static markAsCrippled(videoId: string, client: string) {
    crippledCache.set(`${videoId}-${client}`, { timestamp: Date.now() });
  }

  static markVideoClientBlocked(videoId: string, client: YouTubeClientType) {
    let blocked = videoBlockedClients.get(videoId);
    if (!blocked) {
      blocked = new Set();
      videoBlockedClients.set(videoId, blocked);
    }
    blocked.add(client);
    setTimeout(() => {
      videoBlockedClients.get(videoId)?.delete(client);
    }, 60000);
  }

  static isVideoClientBlocked(videoId: string, client: YouTubeClientType) {
    return videoBlockedClients.get(videoId)?.has(client) || false;
  }

  static setPrefetchedData(videoId: string, itag: number, data: Buffer, contentType: string) {
    const key = `${videoId}:${itag}`;
    prefetchQueue.set(key, { data, contentType, expiresAt: Date.now() + 60000 });
    if (prefetchQueue.size > 20) {
      const oldestKey = prefetchQueue.keys().next().value;
      if (oldestKey) prefetchQueue.delete(oldestKey);
    }
  }

  static getPrefetchedData(videoId: string, itag: number) {
    const key = `${videoId}:${itag}`;
    const cached = prefetchQueue.get(key);
    if (!cached) return null;
    if (Date.now() > cached.expiresAt) {
      prefetchQueue.delete(key);
      return null;
    }
    return cached;
  }

  // --- Shared Normalizers ---

  public static normalizeVideoItem(candidate: any): VideoSummary | null {
    if (!candidate || typeof candidate !== 'object') return null;

    const rawType = String(candidate?.type || '');
    const isChannel = rawType.includes('Channel');
    const isPlaylist = rawType.includes('Playlist');
    const isMovie = rawType.includes('Movie');
    
    // Skip internal UI elements
    if (rawType.includes('Shelf') || rawType.includes('DidYouMean') || rawType.includes('Message')) return null;

    const id = candidate?.video_id || candidate?.videoId || candidate?.id || candidate?.channel_id || candidate?.playlist_id || candidate?.endpoint?.payload?.videoId || candidate?.endpoint?.payload?.browseId;
    if (typeof id !== 'string' || !id) return null;

    const title = stringifyText(candidate?.title?.original_text) || 
                  stringifyText(candidate?.headline?.original_text) ||
                  stringifyText(candidate?.title) || 
                  stringifyText(candidate?.headline) || 
                  stringifyText(candidate?.name) || 
                  stringifyText(candidate?.text);
    
    if (!title) return null;

    const { artist, artistId } = YouTubeService.extractArtistRef(candidate);
    
    const authorRaw = stringifyText(candidate?.author?.name) || 
                   stringifyText(candidate?.author) || 
                   stringifyText(candidate?.short_byline_text) || 
                   stringifyText(candidate?.long_byline_text) || 
                   stringifyText(artist) || 
                   '';
    const author = authorRaw === 'N/A' ? '' : authorRaw;

    const authorId = candidate?.author?.id || 
                     candidate?.author?.channel_id || 
                     candidate?.short_byline_text?.endpoint?.payload?.browseId || 
                     candidate?.long_byline_text?.endpoint?.payload?.browseId || 
                     artistId || 
                     null;

    const type = isChannel ? 'channel' : isPlaylist ? 'playlist' : isMovie ? 'movie' : 'video';

    const durationText = stringifyText(candidate?.length_text) || stringifyText(candidate?.duration?.text) || stringifyText(candidate?.duration) || '';
    const viewCountText = stringifyText(candidate?.view_count?.text) || stringifyText(candidate?.view_count) || stringifyText(candidate?.video_count) || stringifyText(candidate?.subscriber_count) || '';
    const publishedText = stringifyText(candidate?.published_time) || stringifyText(candidate?.published) || '';

    return {
      id,
      title,
      author,
      authorId,
      authorUrl: null,
      thumbnail: upgradeThumbnail(candidate?.thumbnail?.contents?.at?.(-1)?.url || candidate?.thumbnails?.at?.(-1)?.url || candidate?.avatar?.contents?.at?.(-1)?.url || ''),
      duration: durationText,
      durationText,
      viewCount: viewCountText,
      viewCountText,
      published: publishedText,
      publishedText,
      description: stringifyText(candidate?.description_snippet) || stringifyText(candidate?.description),
      isLive: Boolean(candidate?.is_live),
      isUpcoming: Boolean(candidate?.upcoming),
      isShort: Boolean(candidate?.type === 'Short' || candidate?.endpoint?.metadata?.url?.includes('/shorts/')),
      type,
      badges: (candidate?.badges ?? []).map((b: any) => stringifyText(b?.label || b)).filter(Boolean),
      channelId: authorId || undefined,
      channelTitle: author || undefined,
      channelThumbnail: upgradeThumbnail(candidate?.author?.thumbnail?.contents?.at?.(-1)?.url || candidate?.author?.thumbnails?.at?.(-1)?.url || '')
    };
  }

  public static extractVideos(payload: any): VideoSummary[] {
    const items: VideoSummary[] = [];
    const seen = new Set<string>();
    const visit = (value: any) => {
      if (!value || typeof value !== 'object') return;
      const normalized = YouTubeService.normalizeVideoItem(value);
      if (normalized && !seen.has(normalized.id)) {
        seen.add(normalized.id);
        items.push(normalized);
      }
      if (Array.isArray(value)) value.forEach(v => visit(v));
      else Object.values(value).forEach(v => visit(v));
    };
    visit(payload);
    return items;
  }

  public static extractRelatedSections(payload: any): RelatedSection[] {
    const sections: RelatedSection[] = [];
    const visit = (value: any) => {
      if (!value || typeof value !== 'object') return;
      if (value?.type === 'Shelf' || value?.type === 'MusicShelf') {
        const title = stringifyText(value.title);
        const items = (value.contents || value.items || [])
          .map((item: any) => YouTubeService.normalizeRelatedItem(item))
          .filter(Boolean);
        if (items.length > 0) sections.push({ title, items });
      }
      if (Array.isArray(value)) value.forEach(v => visit(v));
      else Object.values(value).forEach(v => visit(v));
    };
    visit(payload);
    return sections;
  }

  public static normalizeRelatedItem(candidate: any): RelatedItem | null {
    const item = YouTubeService.normalizeVideoItem(candidate);
    if (item && item.type === 'video') {
      return {
        ...item,
        type: 'video',
        artist: item.author,
        artistId: item.authorId,
        subtitle: '',
        year: '',
        itemCount: ''
      };
    }
    return null;
  }

  public static extractArtistRef(candidate: any) {
    const artist = candidate?.author?.name || candidate?.artists?.[0]?.name || null;
    const artistId = candidate?.author?.id || candidate?.artists?.[0]?.id || null;
    return { artist, artistId };
  }

  private static normalizePlayerStreamingData(streamingData: any, ustreamerConfig?: string, videoId?: string, client?: string) {
    if (!streamingData) return null;
    const normalize = (format: any) => {
      const mimeType = format.mimeType || format.mime_type || '';
      const mimeParts = mimeType.split(';');
      const codecsMatch = /codecs="([^"]+)"/.exec(mimeType);
      const approxDurationMs = typeof format.approx_duration_ms === 'number' ? format.approx_duration_ms : null;
      return {
        itag: Number(format.itag),
        mimeType,
        container: mimeParts[0] || '',
        codecs: codecsMatch?.[1] || '',
        quality: `${format.quality || ''}`,
        qualityLabel: `${format.quality_label || ''}`,
        bitrate: Number(format.bitrate || format.average_bitrate || 0),
        fps: typeof format.fps === 'number' ? format.fps : null,
        width: typeof format.width === 'number' ? format.width : null,
        height: typeof format.height === 'number' ? format.height : null,
        audioChannels: typeof format.audio_channels === 'number' ? format.audio_channels : null,
        hasVideo: Boolean(format.has_video),
        hasAudio: Boolean(format.has_audio),
        url: `/api/proxy/segment?v=${videoId}&itag=${format.itag}&src=${client}`,
        originalUrl: format.url || null,
        signatureCipher: format.signatureCipher || format.signature_cipher || null,
        cipher: format.cipher || null,
        contentLength: typeof format.content_length === 'number' ? format.content_length : null,
        approxDurationMs,
        duration: (approxDurationMs || 0) / 1000,
        initRange: normalizeByteRange(format.init_range || format.initRange),
        indexRange: normalizeByteRange(format.index_range || format.indexRange),
        audioSampleRate: typeof format.audio_sample_rate === 'number' ? format.audio_sample_rate : null
      };
    };
    return {
      ...streamingData,
      formats: (streamingData.formats || []).map(normalize),
      adaptive_formats: (streamingData.adaptive_formats || streamingData.adaptiveFormats || []).map(normalize),
      dash_manifest_url: streamingData.dash_manifest_url || streamingData.dashManifestUrl,
      hls_manifest_url: streamingData.hls_manifest_url || streamingData.hlsManifestUrl,
      video_playback_ustreamer_config: ustreamerConfig
    };
  }

  public static normalizeManifestStream(videoId: string, format: any, client: string): any {
    const mimeType = format.mimeType || format.mime_type || '';
    const mimeParts = mimeType.split(';');
    const codecsMatch = /codecs="([^"]+)"/.exec(mimeType);
    const approxDurationMs = typeof format.approx_duration_ms === 'number' ? format.approx_duration_ms : (typeof format.approxDurationMs === 'number' ? format.approxDurationMs : null);
    
    return {
      itag: Number(format.itag),
      mimeType,
      container: mimeParts[0] || '',
      codecs: codecsMatch?.[1] || '',
      quality: `${format.quality || ''}`,
      qualityLabel: `${format.quality_label || format.qualityLabel || ''}`,
      bitrate: Number(format.bitrate || format.average_bitrate || format.averageBitrate || 0),
      fps: typeof format.fps === 'number' ? format.fps : null,
      width: typeof format.width === 'number' ? format.width : null,
      height: typeof format.height === 'number' ? format.height : null,
      audioChannels: typeof format.audio_channels === 'number' ? format.audio_channels : (typeof format.audioChannels === 'number' ? format.audioChannels : null),
      hasVideo: Boolean(format.has_video || format.hasVideo),
      hasAudio: Boolean(format.has_audio || format.hasAudio),
      url: format.url?.startsWith('/api/proxy') ? format.url : `/api/proxy/segment?v=${videoId}&itag=${format.itag}&src=${client}`,
      originalUrl: format.originalUrl || format.url || null,
      signatureCipher: format.signatureCipher || format.signature_cipher || null,
      cipher: format.cipher || null,
      contentLength: typeof format.content_length === 'number' ? format.content_length : (typeof format.contentLength === 'number' ? format.contentLength : null),
      approxDurationMs,
      duration: (approxDurationMs || 0) / 1000,
      initRange: normalizeByteRange(format.init_range || format.initRange),
      indexRange: normalizeByteRange(format.index_range || format.indexRange),
      audioSampleRate: typeof format.audio_sample_rate === 'number' ? format.audio_sample_rate : (typeof format.audioSampleRate === 'number' ? format.audioSampleRate : null)
    };
  }

  // --- Legacy Compatibility or Proxies ---
  public static getThumbnailUrl(c: any) { return upgradeThumbnail(c?.thumbnails?.at?.(-1)?.url || c?.thumbnail?.thumbnails?.at?.(-1)?.url || c?.thumbnail?.url || ''); }
  public static extractTracks(p: any) { return YouTubeService.extractVideos(p); }

  /**
   * 背景ジョブを初期化し、セッションや PoToken の鮮度を維持する
   */
  public static initJobs() {
    console.log('[YouTubeService] Initializing periodic background jobs...');
    
    // 1時間ごとにアクティブクライアントのセッションと PoToken をリフレッシュ
    setInterval(async () => {
      console.log('[YouTubeService] Background Job: Refreshing active clients and PoTokens...');
      const clients: YouTubeClientType[] = ['WEB', 'WEB_REMIX', 'ANDROID', 'TV'];
      for (const client of clients) {
        try {
          // ダミーの動画IDを使用して PoToken 生成とセッション維持を行う
          await getYouTubeForPlayback('ZTlH8A79xFg', client);
        } catch (e) {
          console.error(`[YouTubeService] Background refresh failed for ${client}:`, e);
        }
      }
    }, 60 * 60 * 1000);
  }
}
