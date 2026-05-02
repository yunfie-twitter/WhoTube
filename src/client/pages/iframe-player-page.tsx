import { useEffect, useMemo, useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { PlaySquare } from 'lucide-react';
import { getCaptions, getManifest, getVideo } from '../lib/api';
import { cn } from '../lib/utils';
import { ShakaVideoPlayer } from '../components/video/shaka-video-player';
import { buildPlaybackStreams } from '../components/watch/watch-player-section';
import { proxyImageUrl } from '../lib/images';
import { getHideEmbedIcon, getHideEmbedInfo } from '../lib/settings';
import { ShakaPlayerHandle } from '../components/video/shaka-video-player';


export function IframePlayerPage() {
  const { id = '' } = useParams();
  const [searchParams] = useSearchParams();
  const autoPlay = searchParams.get('autoplay') !== '0';
  const startTime = Number(searchParams.get('start') || searchParams.get('t') || 0);
  const enableJsApi = searchParams.get('enablejsapi') === '1';
  const isShorts = searchParams.get('is_shorts') === '1';
  const playerRef = useRef<ShakaPlayerHandle>(null);


  // URLパラメータまたはグローバル設定から非表示フラグを取得
  const [hideIcon, setHideIcon] = useState(() => {
    const p = searchParams.get('modestbranding');
    if (p === '1') return true;
    return getHideEmbedIcon();
  });
  const [hideInfo, setHideInfo] = useState(() => {
    const p = searchParams.get('showinfo');
    if (p === '0') return true;
    return getHideEmbedInfo();
  });

  useEffect(() => {
    const onSettingsChanged = () => {
      const pIcon = searchParams.get('modestbranding');
      setHideIcon(pIcon === '1' || getHideEmbedIcon());
      const pInfo = searchParams.get('showinfo');
      setHideInfo(pInfo === '0' || getHideEmbedInfo());
    };
    window.addEventListener('whotube:settings-changed', onSettingsChanged);
    return () => window.removeEventListener('whotube:settings-changed', onSettingsChanged);
  }, [searchParams]);

  // WhoTube Iframe Player API support
  useEffect(() => {
    if (!enableJsApi) return;

    const handleMessage = (event: MessageEvent) => {
      // origin check could be added here if needed
      const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      if (data.event === 'command' && data.func && playerRef.current) {
        const func = data.func as keyof ShakaPlayerHandle;
        const args = data.args || [];
        if (typeof playerRef.current[func] === 'function') {
          (playerRef.current[func] as any)(...args);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [enableJsApi, searchParams]);

  const onPlayerReady = () => {
    if (!enableJsApi) return;
    window.parent.postMessage(JSON.stringify({
      event: 'onReady',
      id: searchParams.get('widgetid') || 1
    }), '*');
  };

  const onStateChange = (state: number) => {
    if (!enableJsApi) return;
    window.parent.postMessage(JSON.stringify({
      event: 'onStateChange',
      info: state,
      id: searchParams.get('widgetid') || 1
    }), '*');
  };

  const manifestQuery = useQuery({
    queryKey: ['manifest', id],
    queryFn: () => getManifest(id),
    enabled: Boolean(id)
  });
  const detailQuery = useQuery({
    queryKey: ['video', id],
    queryFn: () => getVideo(id),
    enabled: Boolean(id)
  });
  const captionsQuery = useQuery({
    queryKey: ['captions', id],
    queryFn: () => getCaptions(id),
    enabled: Boolean(id && manifestQuery.isSuccess)
  });

  const streams = useMemo(() => buildPlaybackStreams(id, manifestQuery.data), [id, manifestQuery.data]);
  const captionTracks = useMemo(
    () =>
      (captionsQuery.data ?? []).slice(0, 4).map((caption) => ({
        src: `/api/captions/${id}/download?lang=${encodeURIComponent(caption.languageCode)}&format=vtt`,
        srclang: caption.languageCode,
        label: caption.name ?? caption.languageCode
      })),
    [captionsQuery.data, id]
  );
  
  const detail = detailQuery.data?.detail;
  const poster = detail?.thumbnails?.[0]?.url ?? detail?.thumbnail;
  const title = detail?.title?.text ?? detail?.title ?? '';
  const author = detail?.author?.name ?? detail?.author ?? '';
  const channelThumbnail = detail?.author?.thumbnails?.[0]?.url ?? detail?.author?.thumbnail;

  const [isStarted, setIsStarted] = useState(autoPlay);

  const handleStart = () => {
    setIsStarted(true);
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black group">
      {!isStarted && (
        <div 
          className="absolute inset-0 z-30 cursor-pointer transition-transform duration-500 hover:scale-[1.02]"
          onClick={handleStart}
        >
          {/* Poster Background */}
          {poster && (
            <img src={proxyImageUrl(poster)} alt={title} className="h-full w-full object-cover opacity-60 transition-opacity group-hover:opacity-80" />
          )}
          <div className="absolute inset-0 flex items-center justify-center">
             <div className="flex h-16 w-24 items-center justify-center rounded-2xl bg-red-600 shadow-2xl transition-all duration-300 group-hover:bg-red-500 group-hover:scale-110">
                <div className="border-y-[12px] border-l-[20px] border-y-transparent border-l-white ml-1" />
             </div>
          </div>
        </div>
      )}

      {/* Top Overlay: Title & Channel */}
      {!hideInfo && (
        <div className={cn(
          "absolute top-0 left-0 right-0 z-40 bg-gradient-to-b from-black/80 via-black/20 to-transparent p-4 transition-opacity duration-300",
          isStarted ? "opacity-0 group-hover:opacity-100" : "opacity-100"
        )}>
          <div className="flex items-center gap-3">
            {channelThumbnail ? (
              <img src={proxyImageUrl(channelThumbnail)} alt={author} className="h-10 w-10 rounded-full object-cover border border-white/10" />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800 text-xs font-bold text-white border border-white/10">
                {(author || '?').slice(0, 1)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-lg font-medium text-white drop-shadow-md">{title}</h1>
              <p className="truncate text-sm text-zinc-300/80 drop-shadow-md">{author}</p>
            </div>
          </div>
        </div>
      )}

      {/* Branding Logo (Bottom Right) */}
      {!hideIcon && (
        <Link 
          to={`/watch/${id}`} 
          target="_blank"
          className={cn(
            "absolute bottom-4 right-4 z-40 flex items-center gap-1.5 rounded-md bg-black/40 px-2 py-1 text-white backdrop-blur-sm transition-opacity duration-300 hover:bg-black/60",
            isStarted ? "opacity-0 group-hover:opacity-100" : "opacity-100"
          )}
        >
          <PlaySquare size={16} className="text-red-600 fill-red-600" />
          <span className="text-xs font-black italic tracking-tighter">WhoTube</span>
        </Link>
      )}

      <div className={cn("h-full w-full", !isStarted && "hidden")}>
        <ShakaVideoPlayer
          ref={playerRef}
          videoId={id}
          streams={streams}
          initialItag={streams[0]?.itag}
          captionTracks={captionTracks}
          poster={poster}
          autoPlay={isStarted}
          startTime={startTime}
          compact={!isShorts}
          isShorts={isShorts}
          loop={isShorts}
          onStateChange={onStateChange}
          onReady={onPlayerReady}
        />
      </div>
    </div>
  );
}
