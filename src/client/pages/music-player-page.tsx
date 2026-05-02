import { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Play, Pause, SkipForward, SkipBack, Shuffle, Repeat, 
  ListMusic, Heart, MoreHorizontal,
  ChevronDown,
  Volume2,
  Music,
  Repeat1,
  Mic2
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getVideo, getManifest, getCaptions, getCoverArt, getLyrics, type LyricsPayload } from '../lib/api';
import { ShakaVideoPlayer } from '../components/video/shaka-video-player';
import { buildPlaybackStreams } from '../components/watch/watch-player-section';
import { QueueManager } from '../lib/queue';
import { proxyImageUrl } from '../lib/images';

export function MusicPlayerPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const videoId = searchParams.get('v') || '';
  
  const [queueState, setQueueState] = useState(QueueManager.state);
  const [isLiked, setIsLiked] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showLyrics, setShowLyrics] = useState(false);
  const lyricsRef = useRef<HTMLDivElement>(null);


  // Listen for time updates from MiniPlayer
  useEffect(() => {
    const handleTimeUpdate = (e: any) => {
      setCurrentTime(e.detail.currentTime);
      setDuration(e.detail.duration);
    };
    window.addEventListener('whotube:time-update', handleTimeUpdate);
    return () => window.removeEventListener('whotube:time-update', handleTimeUpdate);
  }, []);

  // Fetch video details
  const { data: videoData } = useQuery({
    queryKey: ['video', videoId],
    queryFn: () => getVideo(videoId),
    enabled: !!videoId
  });

  const videoDetail = videoData?.detail;

  // Fetch lyrics
  const { data: lyrics } = useQuery({
    queryKey: ['lyrics', videoId],
    queryFn: () => getLyrics(videoId),
    enabled: !!videoId && showLyrics,
    staleTime: 1000 * 60 * 60
  });

  // Fetch cover art from iTunes
  const { data: itunesCoverArt } = useQuery({
    queryKey: ['itunes-cover', videoDetail?.title?.text || videoDetail?.title, videoDetail?.author?.name || videoDetail?.author],
    queryFn: () => getCoverArt(
      videoDetail?.title?.text || videoDetail?.title || '', 
      videoDetail?.author?.name || videoDetail?.author || ''
    ),
    enabled: !!videoDetail,
    staleTime: 1000 * 60 * 60 // 1 hour
  });

  const currentSong = useMemo(() => {
    if (!videoDetail) return null;
    return {
      title: videoDetail.title?.text ?? videoDetail.title ?? 'Unknown Title',
      artist: videoDetail.author?.name ?? videoDetail.author ?? 'Unknown Artist',
      albumArt: itunesCoverArt || proxyImageUrl(videoDetail.thumbnails?.[videoDetail.thumbnails.length - 1]?.url ?? videoDetail.thumbnail),
      duration: videoDetail.durationText ?? '0:00',
    };
  }, [videoDetail, itunesCoverArt]);

  const queue = queueState.items;

  const isSyncingRef = useRef(false);

  // Sync Logic: URL <-> QueueManager
  useEffect(() => {
    const qState = QueueManager.state;
    const currentQueueVideo = qState.items[qState.currentIndex];

    // Case 1: URL videoId changed (e.g. user navigated or clicked a link)
    if (videoId && currentQueueVideo?.id !== videoId) {
      const indexInQueue = qState.items.findIndex(v => v.id === videoId);
      if (indexInQueue !== -1) {
        isSyncingRef.current = true;
        QueueManager.jumpTo(indexInQueue);
        isSyncingRef.current = false;
      }
    }
  }, [videoId]);

  // Handle automatic song changes (e.g. song ended, next button)
  useEffect(() => {
    const handleQueueChange = (e: any) => {
      setQueueState({ ...e.detail });
      if (isSyncingRef.current) return; // Ignore if we just jumped from URL sync

      const qState = e.detail;
      const currentQueueVideo = qState.items[qState.currentIndex];
      if (currentQueueVideo && currentQueueVideo.id !== videoId) {
        navigate(`/music/player?v=${currentQueueVideo.id}`, { replace: true });
      }
    };
    window.addEventListener('whotube:queue-changed', handleQueueChange);
    return () => window.removeEventListener('whotube:queue-changed', handleQueueChange);
  }, [videoId, navigate]);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    window.dispatchEvent(new CustomEvent('whotube:seek-to', { detail: { time } }));
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Find active lyric line
  const activeLineIndex = useMemo(() => {
    if (!lyrics?.lines || lyrics.kind !== 'timed') return -1;
    let index = -1;
    for (let i = 0; i < lyrics.lines.length; i++) {
      if (lyrics.lines[i].time <= currentTime) {
        index = i;
      } else {
        break;
      }
    }
    return index;
  }, [lyrics, currentTime]);

  // Auto-scroll lyrics
  useEffect(() => {
    if (activeLineIndex !== -1 && lyricsRef.current) {
      const activeElement = lyricsRef.current.children[activeLineIndex] as HTMLElement;
      if (activeElement) {
        activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [activeLineIndex]);

  if (!videoId) {
    return (
      <div className="flex h-full items-center justify-center bg-[#0f0f0f] text-white">
        <p>動画を選択してください</p>
      </div>
    );
  }

  return (
    <div className="relative flex h-[calc(100vh-64px)] w-full flex-col overflow-hidden bg-black md:flex-row">
      {/* Dynamic Blurred Background */}
      {currentSong && (
        <div 
          className="absolute inset-0 z-0 bg-cover bg-center opacity-40 blur-[100px] transition-all duration-1000"
          style={{ backgroundImage: `url(${currentSong.albumArt})` }}
        />
      )}
      <div className="absolute inset-0 z-0 bg-gradient-to-b from-black/20 via-black/60 to-black/90" />

      {/* Main Content Area */}
      <div className="relative z-10 flex flex-1 flex-col p-6 md:p-10">
        
        {/* Top Header */}
        <div className="flex items-center justify-between mb-4 md:mb-8">
          <button 
            onClick={() => navigate('/music')}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md transition-colors hover:bg-white/20"
          >
            <ChevronDown size={24} />
          </button>
          <div className="text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">現在再生中</p>
            <p className="text-sm font-semibold text-white">Music Player</p>
          </div>
          <button className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md transition-colors hover:bg-white/20">
            <MoreHorizontal size={24} />
          </button>
        </div>

        {/* Player Container */}
        <div className="flex flex-1 flex-col items-center justify-center gap-8 pb-8">
          {/* Main Visual or Lyrics */}
          <div className="relative w-full max-w-[800px] h-full flex flex-col items-center justify-center gap-8">
             {showLyrics ? (
               <div 
                 className="relative w-full h-[300px] sm:h-[450px] overflow-hidden"
                 style={{ maskImage: 'linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)' }}
               >
                 <div 
                    ref={lyricsRef}
                    className="h-full overflow-y-auto no-scrollbar p-4 sm:p-8 text-center space-y-8"
                 >
                   {lyrics?.kind === 'timed' ? (
                     lyrics.lines.map((line, i) => (
                       <p 
                        key={i}
                        className={cn(
                          "text-xl sm:text-3xl font-bold transition-all duration-500 cursor-pointer hover:text-white",
                          i === activeLineIndex 
                            ? "text-white scale-110 opacity-100" 
                            : "text-zinc-500 opacity-40 scale-100 hover:opacity-70"
                        )}
                        onClick={() => window.dispatchEvent(new CustomEvent('whotube:seek-to', { detail: { time: line.time } }))}
                       >
                         {line.text}
                       </p>
                     ))
                   ) : lyrics?.kind === 'plain' ? (
                     <div className="whitespace-pre-wrap text-lg text-zinc-300 leading-relaxed">
                       {lyrics.plainText}
                     </div>
                   ) : (
                     <div className="flex h-full items-center justify-center text-zinc-500">
                       <p>{lyrics ? '歌詞が見つかりませんでした' : '歌詞を読み込み中...'}</p>
                     </div>
                   )}
                 </div>
               </div>
             ) : (
               <>
                {/* Main Visual (Cover Art) */}
                <div className="group relative aspect-square w-full max-w-[320px] sm:max-w-[450px] overflow-hidden rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.6)] transition-all duration-500 hover:scale-[1.02]">
                  {currentSong?.albumArt ? (
                    <img 
                      src={currentSong.albumArt} 
                      alt="Cover Art" 
                      className={cn(
                        "h-full w-full object-cover transition-transform duration-700",
                        queueState.isPlaying ? "scale-105" : "scale-100 opacity-80"
                      )}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-zinc-900">
                      <Music size={64} className="text-zinc-700 animate-pulse" />
                    </div>
                  )}
                  
                  {/* Play/Pause Overlay on Hover */}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity group-hover:opacity-100">
                      <button 
                        onClick={() => QueueManager.togglePlay()}
                        className="flex h-20 w-20 items-center justify-center rounded-full bg-white/20 backdrop-blur-md text-white transition-transform hover:scale-110"
                      >
                        {queueState.isPlaying ? <Pause size={40} fill="currentColor" /> : <Play size={40} className="ml-2" fill="currentColor" />}
                      </button>
                  </div>
                </div>

                {/* Song Info (Large) */}
                <div className="w-full max-w-[640px] text-center">
                   <div className="flex flex-col items-center gap-2">
                      <h2 className="line-clamp-1 text-3xl font-black text-white sm:text-5xl tracking-tight">
                        {currentSong?.title ?? '読み込み中...'}
                      </h2>
                      <p className="text-xl font-medium text-zinc-400 sm:text-2xl">
                        {currentSong?.artist ?? ''}
                      </p>
                   </div>
                </div>
               </>
             )}

            {/* Seekbar */}
            <div className="w-full max-w-[600px] space-y-2">
               <input 
                 type="range"
                 min={0}
                 max={duration || 0}
                 value={currentTime}
                 onChange={handleSeek}
                 className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-white/10 accent-white transition-all hover:bg-white/20"
               />
               <div className="flex justify-between text-xs font-bold text-zinc-500">
                 <span>{formatTime(currentTime)}</span>
                 <span>{formatTime(duration)}</span>
               </div>
            </div>
          </div>
        </div>

        {/* Footer Controls (Mobile) / Secondary Controls */}
        <div className="mx-auto mt-auto w-full max-w-[800px] flex items-center justify-between text-zinc-400">
           <button 
             onClick={() => QueueManager.toggleShuffle()}
             className={cn("transition-colors", queueState.isShuffle ? "text-red-500" : "hover:text-white")}
           >
             <Shuffle size={20} />
           </button>
           <div className="flex items-center gap-8">
              <button onClick={() => {
                const prev = QueueManager.previous();
                if (prev) navigate(`/music/player?v=${prev.id}`);
              }} className="hover:text-white transition-transform hover:scale-110"><SkipBack size={32} fill="currentColor" /></button>
              
              <button 
                onClick={() => QueueManager.togglePlay()}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-black transition-transform hover:scale-105 active:scale-95"
              >
                {queueState.isPlaying ? <Pause size={32} fill="currentColor" /> : <Play size={32} className="ml-1" fill="currentColor" />}
              </button>

              <button 
                onClick={() => {
                  const next = QueueManager.next();
                  if (next) navigate(`/music/player?v=${next.id}`);
                }}
                className="hover:text-white transition-transform hover:scale-110"
              >
                <SkipForward size={32} fill="currentColor" />
              </button>
           </div>
           <div className="flex items-center gap-4">
              <button 
                onClick={() => QueueManager.toggleRepeat()}
                className={cn("transition-colors", queueState.repeatMode !== 'none' ? "text-red-500" : "hover:text-white")}
              >
                {queueState.repeatMode === 'one' ? <Repeat1 size={20} /> : <Repeat size={20} />}
              </button>
              <button 
                onClick={() => setShowLyrics(!showLyrics)}
                className={cn("transition-colors", showLyrics ? "text-red-500" : "hover:text-white")}
              >
                <Mic2 size={20} />
              </button>
           </div>
        </div>
      </div>

      {/* Right Sidebar - Queue (Desktop Only) */}
      <div className="relative z-10 hidden w-[350px] flex-col border-l border-white/10 bg-black/40 backdrop-blur-xl lg:flex">
        <div className="flex items-center justify-between border-b border-white/10 p-6">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <ListMusic size={20} /> 次の曲
          </h3>
        </div>
        <div 
          className="flex-1 overflow-y-auto p-4 no-scrollbar space-y-2"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {queue.map((song, index) => (
            <div 
              key={`${song.id}-${index}`} 
              onClick={() => navigate(`/music/player?v=${song.id}`)}
              className={cn(
                "flex items-center gap-4 rounded-xl p-3 transition-colors cursor-pointer group",
                song.id === videoId ? "bg-white/20" : "hover:bg-white/10"
              )}
            >
              <div className="relative flex h-12 w-12 items-center justify-center rounded-md bg-white/10 overflow-hidden">
                <img src={proxyImageUrl(song.thumbnail)} alt="" className="h-full w-full object-cover opacity-60" />
                <Play size={20} className="absolute text-white opacity-0 group-hover:opacity-100 transition-opacity fill-current" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-bold text-white">{song.title}</p>
                <p className="truncate text-xs text-zinc-400">{song.channelTitle}</p>
              </div>
              <span className="text-xs text-zinc-500">{song.durationText}</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
