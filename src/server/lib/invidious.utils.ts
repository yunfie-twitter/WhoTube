import { VideoSummary, VideoDetailsPayload, ManifestStream } from './types.js';

export interface InvidiousThumbnail {
  quality: string;
  url: string;
  width: number;
  height: number;
}

export interface InvidiousVideoObject {
  type: 'video';
  title: string;
  videoId: string;
  author: string;
  authorId: string;
  authorUrl: string;
  authorVerified: boolean;
  videoThumbnails: InvidiousThumbnail[];
  description: string;
  descriptionHtml: string;
  viewCount: number;
  viewCountText: string;
  lengthSeconds: number;
  published: number;
  publishedText: string;
  premiereTimestamp?: number;
  liveNow: boolean;
  premium: boolean;
  isUpcoming: boolean;
  isNew: boolean;
  is4k: boolean;
  is8k: boolean;
  isVr180: boolean;
  isVr360: boolean;
  is3d: boolean;
  hasCaptions: boolean;
}

export class InvidiousUtils {
  static toInvidiousThumbnail(url: string): InvidiousThumbnail[] {
    // Invidious often returns multiple qualities. For now we provide one.
    return [
      { quality: 'maxresdefault', url, width: 1280, height: 720 },
      { quality: 'sddefault', url, width: 640, height: 480 },
      { quality: 'high', url, width: 480, height: 360 },
      { quality: 'medium', url, width: 320, height: 180 },
      { quality: 'default', url, width: 120, height: 90 },
    ];
  }

  static toVideoObject(v: VideoSummary | VideoDetailsPayload): InvidiousVideoObject {
    const id = (v as VideoSummary).id || (v as VideoDetailsPayload).id;
    const authorId = v.authorId || '';
    const durationSeconds = (v as VideoDetailsPayload).durationSeconds || this.parseDurationToSeconds(v.duration);

    return {
      type: 'video',
      title: v.title,
      videoId: id,
      author: v.author,
      authorId: authorId,
      authorUrl: authorId ? `/channel/${authorId}` : '',
      authorVerified: false,
      videoThumbnails: this.toInvidiousThumbnail(v.thumbnail),
      description: v.description || '',
      descriptionHtml: v.description || '',
      viewCount: typeof v.viewCount === 'number' ? v.viewCount : parseInt(v.viewCount?.replace(/[^0-9]/g, '') || '0'),
      viewCountText: String(v.viewCount || '0'),
      lengthSeconds: durationSeconds,
      published: 0, // Placeholder
      publishedText: v.published || '',
      liveNow: v.isLive,
      premium: false,
      isUpcoming: v.isUpcoming,
      isNew: false,
      is4k: false,
      is8k: false,
      isVr180: false,
      isVr360: false,
      is3d: false,
      hasCaptions: false
    };
  }

  static parseDurationToSeconds(duration: string): number {
    if (!duration) return 0;
    const parts = duration.split(':').map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return parts[0] || 0;
  }

  static toAdaptiveFormat(s: ManifestStream) {
    return {
      index: String(s.itag),
      bitrate: String(s.bitrate),
      init: s.initRange ? `${s.initRange.start}-${s.initRange.end}` : '',
      url: s.url,
      itag: String(s.itag),
      type: s.mimeType,
      clen: String(s.contentLength || ''),
      lmt: '',
      projectionType: 'RECTANGULAR',
      container: s.container,
      encoding: s.codecs,
      qualityLabel: s.qualityLabel || null,
      resolution: s.width && s.height ? `${s.width}x${s.height}` : null,
      fps: s.fps || 0,
      size: s.contentLength ? String(s.contentLength) : null,
      audioQuality: s.hasAudio && !s.hasVideo ? (s.bitrate > 128000 ? 'AUDIO_QUALITY_HIGH' : 'AUDIO_QUALITY_MEDIUM') : null,
      audioSampleRate: s.audioSampleRate ? String(s.audioSampleRate) : null,
      audioChannels: s.audioChannels ? String(s.audioChannels) : null
    };
  }
}
