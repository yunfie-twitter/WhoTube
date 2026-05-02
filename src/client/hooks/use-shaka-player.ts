import { useEffect, useRef, useState, useMemo } from 'react';
import shaka from 'shaka-player/dist/shaka-player.ui';
import type { ManifestStream } from '../lib/types';
import { 
  getAlwaysLoop, 
  getInitialPlaybackRate, 
  getPreferredCodec, 
  getSavePosition, 
  setVolume, 
  getVolume,
  type PreferredCodec 
} from '../lib/settings';
import { proxyImageUrl } from '../lib/images';
import { registerShakaCustomElements } from '../components/video/shaka-ui-elements';

const PLAYBACK_ERROR_DELAY_MS = 8000;
const POSITION_SAVE_PREFIX = 'whotube:pos:';

const SHAKA_VIDEO_CODEC_PREFERENCES: Record<PreferredCodec, string[]> = {
  auto: [],
  av1: ['av01'],
  vp9: ['vp09', 'vp9'],
  avc1: ['avc1']
};

function resolveMimeType(stream: ManifestStream): string {
  if (stream.playbackMode === 'dash' || stream.mimeType?.includes('dash')) {
    return 'application/dash+xml';
  }
  if (stream.playbackMode === 'hls' || stream.mimeType?.includes('mpegurl')) {
    return 'application/x-mpegURL';
  }
  if (stream.url?.startsWith('offline:')) {
    return '';
  }
  if (stream.url?.startsWith('blob:')) {
    return 'video/mp4';
  }
  return stream.mimeType?.split(';')[0] || 'video/mp4';
}

function toAbsoluteUrl(url: string): string {
  if (url.startsWith('http') || url.startsWith('offline:') || url.startsWith('blob:')) return url;
  return new URL(url, window.location.origin).href;
}

export function useShakaPlayer({
  containerRef,
  videoRef,
  streams,
  initialItag,
  captionTracks,
  title,
  author,
  poster,
  autoPlay,
  startTime,
  videoId,
  onReady,
  onPlaybackEnded,
  onTimeUpdate,
  onStateChange
}: any) {
  const playerRef = useRef<shaka.Player | null>(null);
  const uiRef = useRef<shaka.ui.Overlay | null>(null);
  const activeSourceRef = useRef<string | null>(null);
  const playbackStartedRef = useRef(false);
  const playbackErrorTimerRef = useRef<number | null>(null);
  const stallRecoveryTimerRef = useRef<number | null>(null);
  const dashToHlsFallbackRef = useRef(false);
  const pendingSeekTimeRef = useRef<number | null>(null);
  
  const [selectedItag, setSelectedItag] = useState<number | undefined>(initialItag);
  const [playerReady, setPlayerReady] = useState(false);
  const [playerState, setPlayerState] = useState(-1);
  const [error, setError] = useState<string | null>(null);

  const streamByItag = useMemo(() => new Map(streams.map((stream: any) => [stream.itag, stream])), [streams]);
  const selectedStream = streamByItag.get(selectedItag ?? -1) ?? streams[0];

  const updateState = (state: number) => {
    setPlayerState(state);
    onStateChange?.(state);
  };

  const getPlaybackPlayer = () => uiRef.current?.getControls()?.getPlayer() ?? playerRef.current;
  const getPlaybackVideo = () => uiRef.current?.getControls()?.getVideo() ?? videoRef.current;

  function applyCodecPreference(player: shaka.Player) {
    const preferredCodec = getPreferredCodec();
    const preferredVideoCodecs = SHAKA_VIDEO_CODEC_PREFERENCES[preferredCodec] ?? [];
    player.configure({ preferredVideoCodecs } as any);
  }

  function clearPlaybackErrorTimer() {
    if (playbackErrorTimerRef.current !== null) {
      window.clearTimeout(playbackErrorTimerRef.current);
      playbackErrorTimerRef.current = null;
    }
  }

  function schedulePlaybackError(message = '再生に失敗しました。別の画質を試してください。') {
    clearPlaybackErrorTimer();
    playbackErrorTimerRef.current = window.setTimeout(() => {
      const video = getPlaybackVideo();
      if (!playbackStartedRef.current && (!video || (video.paused && !video.ended))) {
        setError(message);
      }
      playbackErrorTimerRef.current = null;
    }, PLAYBACK_ERROR_DELAY_MS);
  }

  // Initialization
  useEffect(() => {
    const container = containerRef.current;
    const video = videoRef.current;
    if (!container || !video || playerRef.current) return;

    registerShakaCustomElements();
    shaka.polyfill.installAll();
    
    const player = new shaka.Player();
    const ui = new shaka.ui.Overlay(player, container, video);
    
    ui.configure({
      controlPanelElements: [
        'play_pause', 'mute', 'volume', 'time_and_duration', 'spacer',
        'captions', 'cast', 'theater_mode', 'overflow_menu', 'fullscreen'
      ],
      overflowMenuButtons: ['quality', 'language', 'captions', 'playback_rate', 'picture_in_picture'],
      castReceiverAppId: '924FBC0E'
    });

    player.configure({
      manifest: { retryParameters: { maxAttempts: 5, timeout: 20000 } },
      streaming: { bufferingGoal: 45, rebufferingGoal: 4, stallEnabled: true, stallThreshold: 1 },
      abr: { enabled: true, defaultBandwidthEstimate: 30_000_000 }
    } as any);

    const onError = (event: Event) => {
      console.error('[Shaka] error:', (event as CustomEvent).detail || event);
      schedulePlaybackError();
    };
    player.addEventListener('error', onError);

    playerRef.current = player;
    uiRef.current = ui;

    player.attach(video).then(() => {
      setPlayerReady(true);
      onReady?.();
    });

    return () => {
      setPlayerReady(false);
      clearPlaybackErrorTimer();
      if (stallRecoveryTimerRef.current) clearTimeout(stallRecoveryTimerRef.current);
      player.destroy();
      ui.destroy();
      playerRef.current = null;
      uiRef.current = null;
    };
  }, []);

  // Video Event Listeners
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onEnded = () => {
      if (videoId) window.localStorage.removeItem(`${POSITION_SAVE_PREFIX}${videoId}`);
      updateState(0);
      onPlaybackEnded?.();
    };
    const onPlaying = () => {
      playbackStartedRef.current = true;
      clearPlaybackErrorTimer();
      updateState(1);
    };
    const onPause = () => updateState(2);
    const onWaiting = () => {
      if (stallRecoveryTimerRef.current) clearTimeout(stallRecoveryTimerRef.current);
      stallRecoveryTimerRef.current = window.setTimeout(() => {
        const player = getPlaybackPlayer();
        if (player && !video.paused) player.retryStreaming().catch(() => {});
      }, 2500);
    };

    video.addEventListener('ended', onEnded);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('pause', onPause);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('stalled', onWaiting);

    const handleTimeUpdate = () => {
      if (videoId && getSavePosition() && video.currentTime > 5 && !video.ended) {
        window.localStorage.setItem(`${POSITION_SAVE_PREFIX}${videoId}`, String(video.currentTime));
      }
      onTimeUpdate?.(video.currentTime, video.duration);
    };
    video.addEventListener('timeupdate', handleTimeUpdate);

    return () => {
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('stalled', onWaiting);
      video.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [playerReady]);

  // Load Stream
  useEffect(() => {
    const player = getPlaybackPlayer();
    const video = getPlaybackVideo();
    if (!playerReady || !player || !video || !selectedStream) return;

    const sourceKey = `${selectedStream.playbackMode || 'direct'}:${selectedStream.itag}:${selectedStream.url}`;
    if (activeSourceRef.current === sourceKey) return;

    playbackStartedRef.current = false;
    if (autoPlay || !video.paused) schedulePlaybackError();

    const previousTime = video.currentTime || 0;
    const playbackRate = activeSourceRef.current ? video.playbackRate : getInitialPlaybackRate();
    const shouldResume = Boolean(activeSourceRef.current);

    async function load() {
      try {
        let targetTime = (startTime !== undefined && !activeSourceRef.current) ? startTime : (shouldResume ? previousTime : null);
        if (targetTime === null && videoId && getSavePosition()) {
          const saved = window.localStorage.getItem(`${POSITION_SAVE_PREFIX}${videoId}`);
          if (saved) targetTime = parseFloat(saved);
        }
        
        pendingSeekTimeRef.current = targetTime;
        const loadUrl = toAbsoluteUrl(selectedStream.url);
        
        applyCodecPreference(player);
        await player.load(loadUrl, targetTime, resolveMimeType(selectedStream));
        
        activeSourceRef.current = sourceKey;
        video.playbackRate = playbackRate;
        
        // Add captions
        await Promise.allSettled(
          captionTracks.map((caption: any) =>
            player.addTextTrackAsync(toAbsoluteUrl(caption.src), caption.srclang, 'subtitles', 'text/vtt', undefined, caption.label)
          )
        );
      } catch (e) {
        console.error('[Shaka] Load failed:', e);
      }
    }

    load();
  }, [selectedStream, playerReady]);

  return {
    playerReady,
    playerState,
    selectedItag,
    setSelectedItag,
    error,
    setError,
    getPlaybackVideo,
    getPlaybackPlayer
  };
}
