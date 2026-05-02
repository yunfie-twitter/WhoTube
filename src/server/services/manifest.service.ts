import { getYouTube, getYouTubeForPlayback, isYouTubeClientCoolingDown, stableFetch } from '../lib/youtube.js';
import { ManifestPayload, ManifestStream, YouTubeClientType } from '../lib/types.js';
import { YouTubeService } from './youtube.service.js';
import { StreamlinkService } from './streamlink.service.js';
import { xmlEscape, hlsEscape, isoDuration, metadataFromBasicInfo, rangeLength } from '../lib/youtube.utils.js';
import { getCompanionBaseUrl } from '../lib/companion.js';

const urlCache = new Map<string, { url: string, timestamp: number, client: YouTubeClientType }>();

export class ManifestService {
  private static CACHE_TTL_URL = 2 * 60 * 60 * 1000;

  static async getManifest(videoId: string, _baseUrl: string, ytInstance?: any): Promise<ManifestPayload> {
    // Companion DASH API を優先試行 (ユーザー要求: APIを優先)
    const companionBaseUrl = getCompanionBaseUrl(videoId);
    const companionManifestUrl = `${companionBaseUrl}/api/manifest/dash/id/${videoId}?local=true`;
    
    const clientsToTry: YouTubeClientType[] = ['ANDROID', 'WEB_REMIX', 'WEB_SAFARI', 'WEB', 'ANDROID_VR', 'TV', 'MWEB'];
    let lastError: any = null;

    for (let i = 0; i < clientsToTry.length; i++) {
      const client = clientsToTry[i];
      if (isYouTubeClientCoolingDown(client)) continue;
      try {
        const { info } = await YouTubeService.getPlaybackInfo(videoId, client, ytInstance, i > 0);
        const metadata = await metadataFromBasicInfo(videoId, info.basic_info || {});

        const filterFormats = (formats: any[]): ManifestStream[] => 
          (formats || []);

        const muxed = filterFormats(info.streaming_data?.formats);
        const adaptive = filterFormats(info.streaming_data?.adaptive_formats);

        const videoOnly = adaptive
          .filter((f) => f.hasVideo && !f.hasAudio)
          .sort((a, b) => (b.height || 0) - (a.height || 0) || b.bitrate - a.bitrate);

        const audioOnly = adaptive
          .filter((f) => f.hasAudio && !f.hasVideo)
          .sort((a, b) => b.bitrate - a.bitrate);

        let streamlinkUrl = null;
        if (info.basic_info?.is_live) {
          streamlinkUrl = await StreamlinkService.getStreamUrl(videoId);
        }

        const payload: ManifestPayload = {
          metadata,
          defaultStream: muxed[0] || videoOnly[0] || audioOnly[0] || null,
          muxed,
          videoOnly,
          audioOnly,
          dashManifestUrl: `/api/proxy/dash/companion?v=${videoId}`, // WhoTube 経由で Companion DASH をプロキシ
          hlsManifestUrl: `/api/proxy/hls?v=${videoId}`,
          nativeHlsUrl: streamlinkUrl || (info as any).streaming_data?.hls_manifest_url || (info as any).streaming_data?.hlsManifestUrl || null,
          sabrStreamingUrl: info.streaming_data?.server_abr_streaming_url || null,
          sabrUstreamerConfig: info.streaming_data?.video_playback_ustreamer_config || null
        };

        if (payload.videoOnly.length === 0 || payload.audioOnly.length === 0) {
          const muxedFallback = muxed.filter(s => s.hasVideo && s.hasAudio);
          if (muxedFallback.length > 0) {
            if (payload.videoOnly.length === 0) payload.videoOnly.push(...muxedFallback);
            if (payload.audioOnly.length === 0) payload.audioOnly.push(...muxedFallback);
          }
          
          if (payload.videoOnly.length === 0) {
            const anyVideo = [...muxed, ...adaptive].filter(s => s.hasVideo);
            if (anyVideo.length > 0) payload.videoOnly.push(...anyVideo);
          }
          if (payload.audioOnly.length === 0) {
            const anyAudio = [...muxed, ...adaptive].filter(s => s.hasAudio);
            if (anyAudio.length > 0) payload.audioOnly.push(...anyAudio);
          }

          // それでもダメなら全フォーマットを突っ込む
          if (payload.videoOnly.length === 0 || payload.audioOnly.length === 0) {
            const all = [...muxed, ...adaptive];
            if (all.length > 0) {
              payload.videoOnly.push(...all);
              payload.audioOnly.push(...all);
            }
          }
        }

        if (payload.videoOnly.length > 0 || payload.audioOnly.length > 0) {
          return payload;
        }
        throw new Error(`Empty formats for ${client}`);
      } catch (error: any) {
        lastError = error;
        console.warn(`[ManifestService] getManifest failed for ${client}:`, error.message);
        // Continue to next client
      }
    }

    console.error(`[ManifestService] getManifest fatal failure for ${videoId}:`, lastError?.message);
    throw lastError || new Error('All manifest attempts failed');
  }

  static async getDecipheredUrl(videoId: string, itag: number, client: YouTubeClientType, ytInstance?: any, allowFallback = true): Promise<{ url: string, client: YouTubeClientType }> {
    const key = `${videoId}-${itag}-${client}`;
    const cached = urlCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_URL) return { url: cached.url, client: cached.client };

    const clientsToTry: YouTubeClientType[] = allowFallback 
      ? [client, ...(['WEB', 'MWEB', 'ANDROID', 'TV', 'ANDROID_VR', 'WEB_REMIX', 'WEB_SAFARI'] as YouTubeClientType[]).filter(c => c !== client)]
      : [client];

    let lastError: any = null;
    
    if (allowFallback) {
      const parallelClients = clientsToTry.slice(0, 5);
      try {
        const result = await Promise.any(parallelClients.map(async (targetClient) => {
          if (YouTubeService.isCrippled(videoId, targetClient)) throw new Error('Crippled');
          if (isYouTubeClientCoolingDown(targetClient, 'media')) throw new Error('Media Cooldown');
          
          let yt = (targetClient === client) ? ytInstance : null;
          let potToken: string | null = null;
          if (!yt) {
            const playback = await getYouTubeForPlayback(videoId, targetClient);
            yt = playback.yt;
            potToken = playback.pot?.poToken || null;
          }

          const playbackInfo = await YouTubeService.getPlaybackInfo(videoId, targetClient, yt);
          const info = playbackInfo.info;
          potToken = potToken || playbackInfo.pot?.poToken || null;

          const format = info.streaming_data?.adaptive_formats?.find((f: any) => f.itag === itag) ||
                         info.streaming_data?.formats?.find((f: any) => f.itag === itag);

          if (!format || (!format.originalUrl && !format.signatureCipher)) throw new Error('Format not found');

          let url: string | null = null;
          if (typeof format.originalUrl === 'string' && format.originalUrl.length > 0) {
            url = format.originalUrl;
          } else if (yt.session.player?.decipher) {
            url = await yt.session.player.decipher(format.originalUrl, format.signatureCipher, format.cipher);
          }

          if (!url) throw new Error('Decipher failed');
          
          if (potToken && !url.includes('pot=') && !url.includes('po_token=')) {
            url += `&pot=${encodeURIComponent(potToken)}`;
          }
          
          if (url.includes('alr=yes')) {
            url = url.replace('alr=yes', 'alr=no');
          } else if (!url.includes('alr=')) {
            url += '&alr=no';
          }
          
          urlCache.set(key, { url, timestamp: Date.now(), client: targetClient });
          return { url, client: targetClient };
        }));
        return result;
      } catch (e) {
        lastError = e;
      }
    }

    for (const targetClient of clientsToTry) {
      try {
        if (YouTubeService.isCrippled(videoId, targetClient)) continue;
        
        let yt = (targetClient === client) ? ytInstance : null;
        let potToken: string | null = null;
        if (!yt) {
          const playback = await getYouTubeForPlayback(videoId, targetClient);
          yt = playback.yt;
          potToken = playback.pot?.poToken || null;
        }
        const playbackInfo = await YouTubeService.getPlaybackInfo(videoId, targetClient, yt);
        const info = playbackInfo.info;
        potToken = potToken || playbackInfo.pot?.poToken || null;

        const format = info.streaming_data?.adaptive_formats?.find((f: any) => f.itag === itag) ||
                       info.streaming_data?.formats?.find((f: any) => f.itag === itag);

        if (!format) continue;

        let url: string | null = null;
        if (typeof format.originalUrl === 'string' && format.originalUrl.length > 0) {
          url = format.originalUrl;
        } else if (yt.session.player?.decipher) {
          url = await yt.session.player.decipher(format.originalUrl, format.signatureCipher, format.cipher);
        }

        if (url) {
          if (potToken && !url.includes('pot=') && !url.includes('po_token=')) {
            url += `&pot=${encodeURIComponent(potToken)}`;
          }

          if (url.includes('alr=yes')) {
            url = url.replace('alr=yes', 'alr=no');
          } else if (!url.includes('alr=')) {
            url += '&alr=no';
          }

          urlCache.set(key, { url, timestamp: Date.now(), client: targetClient });
          return { url, client: targetClient };
        }
      } catch (e: any) {
        lastError = e;
        console.warn(`[ManifestService] getDecipheredUrl attempt failed for ${targetClient}:`, e.message);
      }
    }

    throw lastError || new Error(`Failed to get deciphered URL for itag ${itag}`);
  }

  static buildDashManifest(videoId: string, streams: ManifestStream[], preferredCodec?: string): string {
    const dashVideoCandidates = streams
      .filter((stream) => stream.hasVideo && !stream.hasAudio && ManifestService.isDashReady(stream));
    const videoStreams = ManifestService.filterVideoStreamsByCodec(dashVideoCandidates, preferredCodec)
      .sort((a, b) => (b.height || 0) - (a.height || 0) || b.bitrate - a.bitrate);
    const audioStreams = streams
      .filter((stream) => stream.hasAudio && !stream.hasVideo && ManifestService.isDashReady(stream))
      .sort((a, b) => b.bitrate - a.bitrate);

    if (videoStreams.length === 0 || audioStreams.length === 0) {
      // フォールバック: muxed ストリームも考慮する
      const muxedStreams = streams.filter(s => s.hasVideo && s.hasAudio);
      if (muxedStreams.length > 0) {
        if (videoStreams.length === 0) videoStreams.push(...muxedStreams);
        if (audioStreams.length === 0) audioStreams.push(...muxedStreams);
      } else {
        // 最終手段: 全てのフィルタを無視して最初のストリームを強制採用
        const rawFormats = streams;
        if (rawFormats.length > 0) {
          videoStreams.push(rawFormats[0]);
          audioStreams.push(rawFormats[0]);
        } else {
          throw new Error('No DASH ready streams available (even muxed)');
        }
      }
    }

    const duration = ManifestService.durationSeconds([...videoStreams, ...audioStreams]);
    const makeBaseUrl = (stream: ManifestStream) => xmlEscape(stream.url);

    const videoRepresentations = videoStreams.map((stream) => `
      <Representation id="v${stream.itag}" mimeType="${xmlEscape(stream.container)}" bandwidth="${stream.bitrate}" width="${stream.width || 0}" height="${stream.height || 0}" frameRate="${stream.fps || 30}" codecs="${xmlEscape(stream.codecs)}">
        <BaseURL>${makeBaseUrl(stream)}</BaseURL>
        <SegmentBase indexRange="${stream.indexRange?.start || 0}-${stream.indexRange?.end || 0}">
          <Initialization range="${stream.initRange?.start || 0}-${stream.initRange?.end || 0}" />
        </SegmentBase>
      </Representation>`).join('');

    const audioRepresentations = audioStreams.map((stream) => `
      <Representation id="a${stream.itag}" mimeType="${xmlEscape(stream.container)}" bandwidth="${stream.bitrate}" audioSamplingRate="${stream.audioSampleRate || 44100}" codecs="${xmlEscape(stream.codecs)}">
        <AudioChannelConfiguration schemeIdUri="urn:mpeg:dash:23003:3:audio_channel_configuration:2011" value="${stream.audioChannels || 2}" />
        <BaseURL>${makeBaseUrl(stream)}</BaseURL>
        <SegmentBase indexRange="${stream.indexRange?.start || 0}-${stream.indexRange?.end || 0}">
          <Initialization range="${stream.initRange?.start || 0}-${stream.initRange?.end || 0}" />
        </SegmentBase>
      </Representation>`).join('');

    const utcTiming = '<UTCTiming schemeIdUri="urn:mpeg:dash:utc:http-iso:2014" value="https://time.akamai.com/?iso" />';

    return `<?xml version="1.0" encoding="UTF-8"?>
<MPD xmlns="urn:mpeg:dash:schema:mpd:2011" profiles="urn:mpeg:dash:profile:isoff-on-demand:2011" type="static" mediaPresentationDuration="${isoDuration(duration)}" minBufferTime="PT1.5S">
  ${utcTiming}
  <Period id="0" duration="${isoDuration(duration)}">
    <AdaptationSet id="0" contentType="video" segmentAlignment="true" startWithSAP="1">
${videoRepresentations}
    </AdaptationSet>
    <AdaptationSet id="1" contentType="audio" lang="und" segmentAlignment="true" startWithSAP="1">
${audioRepresentations}
    </AdaptationSet>
  </Period>
</MPD>`;
  }

  static buildHlsMasterPlaylist(videoId: string, streams: ManifestStream[], preferredCodec?: string): string {
    const hlsVideoCandidates = streams
      .filter((stream) => stream.hasVideo && !stream.hasAudio && ManifestService.isHlsReady(stream));
    const videoStreams = ManifestService.filterVideoStreamsByCodec(hlsVideoCandidates, preferredCodec)
      .sort((a, b) => (b.height || 0) - (a.height || 0) || b.bitrate - a.bitrate);
    const audioStreams = streams
      .filter((stream) => stream.hasAudio && !stream.hasVideo && ManifestService.isHlsReady(stream))
      .sort((a, b) => b.bitrate - a.bitrate);

    if (videoStreams.length === 0 || audioStreams.length === 0) {
      const muxedStreams = streams.filter(s => s.hasVideo && s.hasAudio);
      if (muxedStreams.length > 0) {
        if (videoStreams.length === 0) videoStreams.push(...muxedStreams);
        if (audioStreams.length === 0) audioStreams.push(...muxedStreams);
      } else {
        throw new Error('No HLS ready streams available (even muxed)');
      }
    }

    const usedClient = streams[0]?.clientType || 'WEB';
    const audio = audioStreams[0];
    const audioUri = `/api/proxy/hls/media?v=${encodeURIComponent(videoId)}&type=audio&itag=${encodeURIComponent(String(audio.itag))}&src=${usedClient}`;
    const lines = [
      '#EXTM3U',
      '#EXT-X-VERSION:7',
      `#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",NAME="Default",DEFAULT=YES,AUTOSELECT=YES,LANGUAGE="und",URI="${hlsEscape(audioUri)}"`
    ];

    for (const stream of videoStreams) {
      const uri = `/api/proxy/hls/media?v=${encodeURIComponent(videoId)}&type=video&itag=${encodeURIComponent(String(stream.itag))}&src=${usedClient}`;
      const codecs = [stream.codecs, audio.codecs].filter(Boolean).join(',');
      lines.push(
        `#EXT-X-STREAM-INF:BANDWIDTH=${stream.bitrate + audio.bitrate},AVERAGE-BANDWIDTH=${stream.bitrate + audio.bitrate},RESOLUTION=${stream.width || 0}x${stream.height || 0},FRAME-RATE=${stream.fps || 30},CODECS="${hlsEscape(codecs)}",AUDIO="audio"`,
        uri
      );
    }

    return `${lines.join('\n')}\n`;
  }

  static buildHlsMediaPlaylist(videoId: string, stream: ManifestStream, clientType?: YouTubeClientType): string {
    if (!ManifestService.isHlsReady(stream)) {
      throw new Error('Stream is not HLS ready');
    }

    const duration = stream.duration || 0;
    const initRange = stream.initRange!;
    const mediaStart = initRange.end + 1;
    const mediaLength = Math.max(1, (stream.contentLength || 0) - mediaStart);
    const usedClient = clientType || stream.clientType || 'WEB';
    const segmentUrl = `/api/proxy/segment?v=${encodeURIComponent(videoId)}&itag=${encodeURIComponent(String(stream.itag))}&src=${usedClient}`;
    const chunkSize = 2 * 1024 * 1024; // 2MB segments for HLS (optimized for throughput)
    const segments: Array<{ start: number; length: number; duration: number }> = [];
    for (let offset = 0; offset < mediaLength; offset += chunkSize) {
      const length = Math.min(chunkSize, mediaLength - offset);
      segments.push({
        start: mediaStart + offset,
        length,
        duration: duration * (length / mediaLength)
      });
    }
    const targetDuration = Math.max(1, Math.ceil(Math.max(...segments.map((segment) => segment.duration))));

    const lines = [
      '#EXTM3U',
      '#EXT-X-VERSION:7',
      `#EXT-X-TARGETDURATION:${targetDuration}`,
      '#EXT-X-MEDIA-SEQUENCE:0',
      '#EXT-X-PLAYLIST-TYPE:VOD',
      `#EXT-X-MAP:URI="${hlsEscape(segmentUrl)}",BYTERANGE="${rangeLength(initRange)}@${initRange.start}"`
    ];

    for (const segment of segments) {
      lines.push(
        `#EXTINF:${segment.duration.toFixed(3)},`,
        `#EXT-X-BYTERANGE:${segment.length}@${segment.start}`,
        segmentUrl
      );
    }

    lines.push('#EXT-X-ENDLIST', '');
    return lines.join('\n');
  }

  // --- Manifest Helpers ---

  private static async normalizeManifestStream(videoId: string, format: any, client: YouTubeClientType, ytInstance?: any): Promise<ManifestStream | null> {
    const stream = YouTubeService.normalizeManifestStream(videoId, format, client);
    if (!stream) return null;

    // もし URL がプロキシ経由でない（＝生データが渡された）場合、かつ originalUrl がない場合
    if (!stream.url.startsWith('/api/proxy') && !stream.originalUrl && stream.signatureCipher) {
      if (ytInstance?.session?.player?.decipher) {
        try {
          stream.originalUrl = await ytInstance.session.player.decipher(stream.url, stream.signatureCipher, stream.cipher);
          stream.url = `/api/proxy/segment?v=${videoId}&itag=${stream.itag}&src=${client}`;
        } catch (e) {
          console.warn(`[ManifestService] Failed to decipher stream for ${videoId}:`, e);
        }
      }
    }

    return stream;
  }

  private static filterVideoStreamsByCodec(streams: ManifestStream[], preferredCodec?: string, hlsOnly?: ManifestStream[]): ManifestStream[] {
    const codec = `${preferredCodec || 'auto'}`.toLowerCase();
    const codecPrefixes = codec === 'av1' ? ['av01'] : codec === 'vp9' ? ['vp09', 'vp9'] : (codec === 'avc1' || codec === 'h264') ? ['avc1'] : [];
    if (codecPrefixes.length === 0) return streams;

    const filtered = streams.filter((stream) => {
      const streamCodecs = `${stream.codecs || ''}`.toLowerCase();
      return codecPrefixes.some((prefix) => streamCodecs.startsWith(prefix) || streamCodecs.includes(`,${prefix}`));
    });
    return filtered.length > 0 ? filtered : streams;
  }

  private static isDashReady(stream: ManifestStream): boolean {
    // 互換性を最大化するため、条件を大幅に緩和
    return Boolean(stream.url || stream.originalUrl);
  }

  private static isHlsReady(stream: ManifestStream): boolean {
    // HLS の手動生成には initRange と indexRange (または contentLength) が必須
    return Boolean(stream.url || stream.originalUrl) && Boolean(stream.initRange && (stream.indexRange || stream.contentLength));
  }

  private static durationSeconds(streams: ManifestStream[]): number {
    return streams[0]?.duration || 0;
  }
}
