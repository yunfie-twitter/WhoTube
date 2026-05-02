import { useEffect, useMemo, useState } from 'react';
import { ShakaVideoPlayer } from '../video/shaka-video-player';
import type { CaptionTrack, ManifestPayload, ManifestStream, VideoItem } from '../../lib/types';
import { getPreferredCodec, type PreferredCodec } from '../../lib/settings';

interface Props {
  videoId: string;
  manifest?: ManifestPayload;
  captions?: CaptionTrack[];
  title: string;
  author: string;
  channelId: string;
  channelThumbnail?: string;
  subscriberCount?: string;
  poster?: string;
  autoPlay?: boolean;
  startTime?: number;
  viewCount?: number;
  likeCount?: number | null;
  endScreenVideos?: VideoItem[];
  onSubscribe: () => void | Promise<void>;
  isTheaterMode?: boolean;
  onToggleTheater?: () => void;
  onPlaybackEnded?: () => void;
}

function withCodecPreference(url: string, codec: PreferredCodec): string {
  if (codec === 'auto') return url;
  const joiner = url.includes('?') ? '&' : '?';
  return `${url}${joiner}codec=${encodeURIComponent(codec)}`;
}

export function buildPlaybackStreams(videoId: string, manifest?: ManifestPayload, preferredCodec: PreferredCodec = 'auto'): ManifestStream[] {
  if (!manifest) {
    return [];
  }

  const streams: ManifestStream[] = [];
  const highestVideo = (manifest.videoOnly ?? [])
    .filter((stream) => stream.hasVideo)
    .sort((a, b) => (b.height ?? 0) - (a.height ?? 0) || (b.bitrate ?? 0) - (a.bitrate ?? 0))[0];
  const bestAudio = (manifest.audioOnly ?? [])
    .filter((stream) => stream.hasAudio)
    .sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0))[0];
  const adaptiveBitrate = (highestVideo?.bitrate ?? 0) + (bestAudio?.bitrate ?? 0);

  if (manifest?.dashManifestUrl) {
    streams.push({
      itag: 0,
      mimeType: 'application/dash+xml',
      container: 'application/dash+xml',
      codecs: '',
      quality: 'auto',
      qualityLabel: 'Auto',
      bitrate: adaptiveBitrate || highestVideo?.bitrate || 100_000_000,
      width: highestVideo?.width,
      height: highestVideo?.height,
      hasVideo: true,
      hasAudio: true,
      playbackMode: 'dash',
      url: withCodecPreference(manifest.dashManifestUrl, preferredCodec)
    });
  }

  if (manifest?.hlsManifestUrl) {
    streams.push({
      itag: -2,
      mimeType: 'application/x-mpegURL',
      container: 'application/x-mpegURL',
      codecs: '',
      quality: 'auto',
      qualityLabel: 'Auto',
      bitrate: adaptiveBitrate || highestVideo?.bitrate || 100_000_000,
      width: highestVideo?.width,
      height: highestVideo?.height,
      hasVideo: true,
      hasAudio: true,
      playbackMode: 'hls',
      url: withCodecPreference(manifest.hlsManifestUrl, preferredCodec)
    });
  }

  if (manifest?.nativeHlsUrl) {
    streams.push({
      itag: -3,
      mimeType: 'application/x-mpegURL',
      container: 'application/x-mpegURL',
      codecs: '',
      quality: 'auto',
      qualityLabel: 'Live (Native)',
      bitrate: adaptiveBitrate || 100_000_000,
      hasVideo: true,
      hasAudio: true,
      playbackMode: 'hls',
      url: manifest.nativeHlsUrl
    });
  }

  const muxed = (manifest?.muxed ?? [])
    .filter((stream) => stream.hasVideo && stream.hasAudio)
    .map((stream) => ({ ...stream, playbackMode: 'direct' as const }))
    .sort((a, b) => (b.height ?? 0) - (a.height ?? 0) || (b.bitrate ?? 0) - (a.bitrate ?? 0));

  const dedup = new Map<number, ManifestStream>();
  for (const stream of [...streams, ...muxed]) {
    dedup.set(stream.itag, stream);
  }

  if (dedup.size === 0 && videoId) {
    dedup.set(-1, {
      itag: -1,
      mimeType: 'video/mp4',
      container: 'video/mp4',
      codecs: '',
      quality: 'auto',
      qualityLabel: 'Auto',
      bitrate: 0,
      hasVideo: true,
      hasAudio: true,
      playbackMode: 'direct',
      url: `/api/proxy/video/${videoId}`
    });
  }

  return [...dedup.values()];
}

export function WatchPlayerSection({
  videoId,
  manifest,
  captions = [],
  title,
  author,
  channelId,
  channelThumbnail,
  subscriberCount,
  poster,
  autoPlay,
  startTime,
  likeCount,
  endScreenVideos = [],
  onSubscribe,
  isTheaterMode = false,
  onToggleTheater,
  onPlaybackEnded
}: Props) {
  const [currentPlaybackTime, setCurrentPlaybackTime] = useState(0);
  const [preferredCodec, setPreferredCodecState] = useState<PreferredCodec>(() => getPreferredCodec());
  const streams = useMemo(() => buildPlaybackStreams(videoId, manifest, preferredCodec), [manifest, preferredCodec, videoId]);
  const initialItag = useMemo(() => {
    return streams.find((s) => s.itag === -3)?.itag
      ?? streams.find((stream) => stream.playbackMode === 'dash')?.itag
      ?? streams.find((stream) => stream.playbackMode === 'hls')?.itag
      ?? streams
        .filter((stream) => stream.hasVideo)
        .sort((a, b) => (b.height ?? b.targetHeight ?? 0) - (a.height ?? a.targetHeight ?? 0) || (b.bitrate ?? 0) - (a.bitrate ?? 0))[0]?.itag
      ?? streams[0]?.itag;
  }, [streams]);

  useEffect(() => {
    const onSettingsChanged = () => setPreferredCodecState(getPreferredCodec());
    window.addEventListener('whotube:settings-changed', onSettingsChanged);
    window.addEventListener('storage', onSettingsChanged);
    return () => {
      window.removeEventListener('whotube:settings-changed', onSettingsChanged);
      window.removeEventListener('storage', onSettingsChanged);
    };
  }, []);

  const captionTracks = useMemo(
    () =>
      captions.slice(0, 20).map((caption) => ({
        src: `/api/captions/${videoId}/download?lang=${encodeURIComponent(caption.languageCode)}&format=vtt`,
        srclang: caption.languageCode,
        label: caption.label || caption.languageCode
      })),
    [captions, videoId]
  );

  const videoUrl = typeof window !== 'undefined' ? `${window.location.origin}/watch/${videoId}` : '';

  return (
    <div className="space-y-4">

      <ShakaVideoPlayer
        videoId={videoId}
        streams={streams}
        initialItag={initialItag}
        captionTracks={captionTracks}
        title={title}
        author={author}
        poster={poster}
        autoPlay={autoPlay}
        startTime={startTime}
        endScreenVideos={endScreenVideos}
        isTheaterMode={isTheaterMode}
        onToggleTheater={onToggleTheater}
        onPlaybackEnded={onPlaybackEnded}
      />
    </div>
  );
}
