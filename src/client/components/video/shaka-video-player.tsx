import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import type { ManifestStream, VideoItem } from '../../lib/types';
import { proxyImageUrl } from '../../lib/images';
import { cn } from '../../lib/utils';
import { 
  getAlwaysLoop, 
  getShowEndscreen, 
  setVolume, 
  getVolume
} from '../../lib/settings';
import { useMediaSession } from '../../hooks/use-media-session';
import { useShakaPlayer } from '../../hooks/use-shaka-player';

export interface ShakaPlayerHandle {
  playVideo: () => void;
  pauseVideo: () => void;
  stopVideo: () => void;
  seekTo: (seconds: number) => void;
  setVolume: (volume: number) => void;
  getVolume: () => number;
  mute: () => void;
  unMute: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
}

interface Props {
  streams: ManifestStream[];
  initialItag?: number;
  captionTracks?: any[];
  title?: string;
  author?: string;
  poster?: string;
  autoPlay?: boolean;
  loop?: boolean;
  compact?: boolean;
  startTime?: number;
  videoId?: string;
  endScreenVideos?: VideoItem[];
  isTheaterMode?: boolean;
  onToggleTheater?: () => void;
  isShorts?: boolean;
  onStateChange?: (state: number) => void;
  onReady?: () => void;
  onPlaybackEnded?: () => void;
  onTimeUpdate?: (time: number, duration: number) => void;
  playing?: boolean;
}

export const ShakaVideoPlayer = forwardRef<ShakaPlayerHandle, Props>((props, ref) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [showEndScreen, setShowEndScreen] = useState(false);

  const {
    playerReady,
    playerState,
    selectedItag,
    setSelectedItag,
    error,
    setError,
    getPlaybackVideo
  } = useShakaPlayer({
    containerRef,
    videoRef,
    ...props
  });

  useMediaSession({
    videoId: props.videoId,
    title: props.title,
    author: props.author,
    poster: props.poster,
    playerState,
    videoRef,
    playerReady
  });

  useImperativeHandle(ref, () => ({
    playVideo: () => getPlaybackVideo()?.play().catch(() => {}),
    pauseVideo: () => getPlaybackVideo()?.pause(),
    stopVideo: () => {
      const v = getPlaybackVideo();
      if (v) { v.pause(); v.currentTime = 0; }
    },
    seekTo: (s) => { const v = getPlaybackVideo(); if (v) v.currentTime = s; },
    setVolume: (vol) => { const v = getPlaybackVideo(); if (v) v.volume = Math.min(1, Math.max(0, vol / 100)); },
    getVolume: () => Math.round((getPlaybackVideo()?.volume || 0) * 100),
    mute: () => { const v = getPlaybackVideo(); if (v) v.muted = true; },
    unMute: () => { const v = getPlaybackVideo(); if (v) v.muted = false; },
    getCurrentTime: () => getPlaybackVideo()?.currentTime || 0,
    getDuration: () => getPlaybackVideo()?.duration || 0,
    getPlayerState: () => playerState
  }), [playerState, getPlaybackVideo]);

  // Handle manual play/pause from props
  useEffect(() => {
    if (props.playing === undefined) return;
    if (props.playing) getPlaybackVideo()?.play().catch(() => {});
    else getPlaybackVideo()?.pause();
  }, [props.playing, getPlaybackVideo]);

  // Volume persistence
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = Math.min(1, Math.max(0, getVolume()));
    const onVolumeChange = () => setVolume(v.volume);
    v.addEventListener('volumechange', onVolumeChange);
    return () => v.removeEventListener('volumechange', onVolumeChange);
  }, []);

  return (
    <div 
      ref={containerRef} 
      className={cn(
        "group relative h-full w-full overflow-hidden bg-black transition-all duration-500",
        props.compact ? "rounded-lg" : (props.isTheaterMode ? "" : "md:rounded-xl"),
        props.isShorts && "aspect-[9/16] max-h-[85vh] w-auto mx-auto shadow-2xl"
      )}
      data-shaka-player-container
    >
      <video
        ref={videoRef}
        className="h-full w-full"
        poster={proxyImageUrl(props.poster) || ''}
        playsInline
        autoPlay={props.autoPlay}
        data-shaka-player
      />

      {error && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 p-6 text-center backdrop-blur-md animate-in fade-in duration-500">
          <div className="mb-4 rounded-full bg-red-500/20 p-3 ring-1 ring-red-500/50">
            <X className="h-8 w-8 text-red-500" />
          </div>
          <p className="max-w-md text-lg font-bold text-white">{error}</p>
          <button
            onClick={() => setError(null)}
            className="mt-6 rounded-full bg-white/10 px-6 py-2 text-sm font-bold text-white transition-all hover:bg-white/20 active:scale-95"
          >
            閉じる
          </button>
        </div>
      )}

      {getShowEndscreen() && showEndScreen && props.endScreenVideos && props.endScreenVideos.length > 0 && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/80 backdrop-blur-lg animate-in fade-in duration-700">
          <div className="grid w-full grid-cols-1 gap-6 p-6 md:grid-cols-3 max-w-5xl">
            {props.endScreenVideos.slice(0, 3).map((video) => (
              <Link 
                key={video.id} 
                to={`/watch/${video.id}?autoplay=1`}
                className="group flex flex-col gap-2 transition-all hover:scale-105"
              >
                <div className="relative aspect-video overflow-hidden rounded-xl bg-zinc-800 ring-1 ring-white/10 shadow-2xl">
                  <img src={proxyImageUrl(video.thumbnail)} alt={video.title} className="h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors" />
                </div>
                <p className="line-clamp-2 text-sm font-bold text-white group-hover:text-red-500 transition-colors">
                  {video.title}
                </p>
              </Link>
            ))}
          </div>
          <button 
            onClick={() => setShowEndScreen(false)}
            className="absolute top-4 right-4 rounded-full bg-black/40 p-2 text-white/60 hover:bg-black/60 hover:text-white transition-all"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
      )}
    </div>
  );
});

ShakaVideoPlayer.displayName = 'ShakaVideoPlayer';
