import { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Play, Pause, SkipForward, SkipBack, 
  Volume2, Repeat, Shuffle, ChevronUp,
  X,
  ThumbsUp,
  ThumbsDown,
  MoreVertical,
  Repeat1
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getManifest, getCoverArt } from '../../lib/api';
import { ShakaVideoPlayer } from '../video/shaka-video-player';
import { buildPlaybackStreams } from '../watch/watch-player-section';
import { QueueManager } from '../../lib/queue';
import { proxyImageUrl } from '../../lib/images';

export function MiniMusicPlayer() {
  const location = useLocation();
  const navigate = useNavigate();
  const [queueState, setQueueState] = useState(QueueManager.state);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  const playerRef = useRef<any>(null);
  
  // Listen for queue changes
  useEffect(() => {
    const handleQueueChange = (e: any) => {
      setQueueState({ ...e.detail });
    };
    window.addEventListener('whotube:queue-changed', handleQueueChange);
    return () => window.removeEventListener('whotube:queue-changed', handleQueueChange);
  }, []);

  // Listen for seek requests
  useEffect(() => {
    const handleSeekTo = (e: any) => {
      if (playerRef.current) {
        playerRef.current.seekTo(e.detail.time);
      }
    };
    window.addEventListener('whotube:seek-to', handleSeekTo);
    return () => window.removeEventListener('whotube:seek-to', handleSeekTo);
  }, []);

  const currentVideo = queueState.items[queueState.currentIndex];

  const isMusicPage = location.pathname === '/music';
  const isMusicPlayerPage = location.pathname === '/music/player';
  const isWatchPage = location.pathname.startsWith('/watch');

  // Pause music if we navigate to a watch page
  useEffect(() => {
    if (isWatchPage && QueueManager.state.isPlaying) {
      QueueManager.pause();
    }
  }, [isWatchPage]);

  // Show the bar UI if:
  // 1. We are on the music page
  // 2. OR music is currently playing and we are NOT on the full player/watch page
  const showBar = isMusicPage || (queueState.isPlaying && !isMusicPlayerPage && !isWatchPage);

  const { data: manifest } = useQuery({
    queryKey: ['manifest', currentVideo?.id],
    queryFn: () => getManifest(currentVideo!.id),
    enabled: !!currentVideo?.id
  });

  const { data: itunesCoverArt } = useQuery({
    queryKey: ['itunes-cover-mini', currentVideo?.title, currentVideo?.channelTitle],
    queryFn: () => getCoverArt(currentVideo!.title, currentVideo!.channelTitle),
    enabled: !!currentVideo,
    staleTime: 1000 * 60 * 60
  });

  const streams = useMemo(() => {
    if (!currentVideo) return [];
    return buildPlaybackStreams(currentVideo.id, manifest);
  }, [manifest, currentVideo?.id]);

  const initialItag = useMemo(() => {
    return streams.find((stream) => stream.playbackMode === 'dash')?.itag
      ?? streams.find((stream) => stream.playbackMode === 'hls')?.itag
      ?? streams[0]?.itag;
  }, [streams]);

  const onPlaybackEnded = () => {
    QueueManager.next();
  };

  const handleTimeUpdate = (time: number, dur: number) => {
    setCurrentTime(time);
    setDuration(dur);
    window.dispatchEvent(new CustomEvent('whotube:time-update', { 
      detail: { currentTime: time, duration: dur } 
    }));
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  if (!currentVideo) return null;

  return (
    <>
      {showBar && (
        <div className="fixed bottom-0 left-0 z-[100] w-full border-t border-white/10 bg-zinc-900/95 p-2 backdrop-blur-lg lg:p-3">
          <div className="mx-auto flex max-w-[1800px] items-center justify-between gap-4">
            
            {/* Controls: Left */}
            <div className="flex items-center gap-2 sm:gap-4">
              <button 
                onClick={() => QueueManager.previous()}
                className="text-zinc-400 transition-colors hover:text-white"
              >
                <SkipBack size={20} fill="currentColor" />
              </button>
              <button 
                onClick={() => QueueManager.togglePlay()}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-black transition-transform hover:scale-105 active:scale-95"
              >
                {queueState.isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} className="ml-0.5" fill="currentColor" />}
              </button>
              <button 
                onClick={() => QueueManager.next()}
                className="text-zinc-400 transition-colors hover:text-white"
              >
                <SkipForward size={20} fill="currentColor" />
              </button>
              <div className="hidden text-xs font-medium text-zinc-500 sm:block">
                {formatTime(currentTime)} / {currentVideo.durationText || formatTime(duration)}
              </div>
            </div>

            {/* Info: Center */}
            <div 
              className="flex flex-1 items-center gap-3 min-w-0 cursor-pointer"
              onClick={() => navigate(`/music/player?v=${currentVideo.id}`)}
            >
              <div className="h-10 w-10 shrink-0 overflow-hidden rounded bg-zinc-800 sm:h-12 sm:w-12">
                <img 
                  src={itunesCoverArt || proxyImageUrl(currentVideo.thumbnail)} 
                  alt="" 
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="min-w-0">
                <h4 className="truncate text-sm font-bold text-white">{currentVideo.title}</h4>
                <p className="truncate text-xs text-zinc-400">{currentVideo.channelTitle}</p>
              </div>
              <div className="hidden items-center gap-1 sm:flex">
                 <button className="p-2 text-zinc-500 hover:text-white transition-colors"><ThumbsDown size={18} /></button>
                 <button className="p-2 text-zinc-500 hover:text-white transition-colors"><ThumbsUp size={18} /></button>
                 <button className="p-2 text-zinc-500 hover:text-white transition-colors"><MoreVertical size={18} /></button>
              </div>
            </div>

            {/* Tools: Right */}
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="hidden items-center gap-4 lg:flex">
                <button className="text-zinc-400 hover:text-white transition-colors"><Volume2 size={20} /></button>
                <button 
                  onClick={() => QueueManager.toggleRepeat()}
                  className={cn("transition-colors", queueState.repeatMode !== 'none' ? "text-red-500" : "text-zinc-400 hover:text-white")}
                >
                  {queueState.repeatMode === 'one' ? <Repeat1 size={20} /> : <Repeat size={20} />}
                </button>
                <button 
                  onClick={() => QueueManager.toggleShuffle()}
                  className={cn("transition-colors", queueState.isShuffle ? "text-red-500" : "text-zinc-400 hover:text-white")}
                >
                  <Shuffle size={20} />
                </button>
              </div>
              <button 
                onClick={() => navigate(`/music/player?v=${currentVideo.id}`)}
                className="rounded-full p-2 text-zinc-400 hover:bg-white/10 hover:text-white"
              >
                <ChevronUp size={24} />
              </button>
              <button 
                onClick={() => QueueManager.clear()}
                className="hidden rounded-full p-2 text-zinc-400 hover:bg-white/10 hover:text-white md:block"
              >
                <X size={20} />
              </button>
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="absolute top-0 left-0 h-0.5 w-full bg-white/10">
             <div className="h-full bg-red-600 transition-all duration-150" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {/* Global Hidden Player (Always rendered if a song is in queue) */}
      <div className="absolute inset-0 -z-10 h-0 w-0 overflow-hidden opacity-0 pointer-events-none">
         {manifest && (
            <ShakaVideoPlayer
              ref={playerRef}
              videoId={currentVideo.id}
              streams={streams}
              initialItag={initialItag}
              autoPlay={queueState.isPlaying}
              playing={queueState.isPlaying}
              loop={queueState.repeatMode === 'one'}
              onPlaybackEnded={onPlaybackEnded}
              onTimeUpdate={handleTimeUpdate}
            />
         )}
      </div>
    </>
  );
}
