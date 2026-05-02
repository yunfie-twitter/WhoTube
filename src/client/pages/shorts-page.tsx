import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getManifest, getVideo } from '../lib/api';
import { ShakaVideoPlayer } from '../components/video/shaka-video-player';
import { 
  ThumbsUp, ThumbsDown, MessageSquare, Share2, 
  MoreVertical, Music2, ChevronUp, ChevronDown, 
  ArrowLeft, Bell
} from 'lucide-react';
import { cn } from '../lib/utils';
import { proxyImageUrl } from '../lib/images';
import { Button } from '../components/ui/button';
import { buildPlaybackStreams } from '../components/watch/watch-player-section';
import { getPreferredCodec } from '../lib/settings';

export function ShortsPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  
  const detailQuery = useQuery({
    queryKey: ['video', id],
    queryFn: () => getVideo(id),
    enabled: Boolean(id)
  });

  const manifestQuery = useQuery({
    queryKey: ['manifest', id],
    queryFn: () => getManifest(id),
    enabled: Boolean(id)
  });

  const preferredCodec = useMemo(() => getPreferredCodec(), []);
  const streams = useMemo(() => {
    if (!id || !manifestQuery.data) return [];
    return buildPlaybackStreams(id, manifestQuery.data, preferredCodec);
  }, [id, manifestQuery.data, preferredCodec]);

  const initialItag = useMemo(() => {
    if (streams.length === 0) return undefined;
    return streams.find(s => s.playbackMode === 'dash')?.itag || 
           streams.find(s => s.playbackMode === 'hls')?.itag || 
           streams[0]?.itag;
  }, [streams]);

  if (detailQuery.isError) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-black text-white">
        <p className="text-lg font-bold">ショート動画が見つかりませんでした</p>
        <Button variant="ghost" className="mt-4" onClick={() => navigate('/')}>ホームに戻る</Button>
      </div>
    );
  }

  const detail = detailQuery.data?.detail;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black text-white lg:relative lg:h-[calc(100vh-56px)]">
      {/* Header (Mobile) */}
      <div className="flex items-center justify-between p-4 lg:hidden">
        <button onClick={() => navigate(-1)} className="rounded-full p-2 hover:bg-white/10">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-lg font-bold">ショート</h1>
        <div className="w-10" />
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden py-4 lg:py-8">
        {/* Video Container */}
        <div className="relative flex h-full w-full max-w-[480px] flex-col items-center justify-center">
          <div className="relative aspect-[9/16] h-full w-full overflow-hidden rounded-xl bg-zinc-900 shadow-2xl ring-1 ring-white/10 md:rounded-2xl lg:h-full">
            {streams.length > 0 ? (
              <ShakaVideoPlayer 
                videoId={id}
                streams={streams}
                initialItag={initialItag}
                autoPlay={true}
                loop={true}
                isShorts={true}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/10 border-t-white" />
              </div>
            )}

            {/* Overlay Info (Mobile style) */}
            <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 pb-8 md:p-6">
              <div className="flex items-center gap-3 mb-4">
                <Link to={`/channel/${detail?.authorId}`} className="group relative h-10 w-10 shrink-0 overflow-hidden rounded-full ring-2 ring-white/20 transition-transform active:scale-90">
                  <img src={proxyImageUrl(detail?.authorThumbnail)} alt="" className="h-full w-full object-cover" />
                </Link>
                <div className="flex flex-col">
                  <Link to={`/channel/${detail?.authorId}`} className="text-[15px] font-bold hover:underline decoration-2 underline-offset-2">@{detail?.author}</Link>
                  <span className="text-[11px] font-medium text-white/60">チャンネル登録者数 1.2M人</span>
                </div>
                <Button className="ml-2 h-8 rounded-full bg-white px-4 text-xs font-bold text-black hover:bg-zinc-200">
                  登録
                </Button>
              </div>
              
              <h2 className="mb-4 line-clamp-2 text-[15px] font-medium leading-relaxed md:text-base">
                {detail?.title}
              </h2>

              <div className="flex items-center gap-2 rounded-full bg-black/20 backdrop-blur-md px-3 py-1.5 w-fit">
                <Music2 size={14} className="animate-pulse" />
                <span className="max-w-[200px] truncate text-[11px] font-bold tracking-tight">
                  オリジナル楽曲 - {detail?.author}
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons (Right side on Desktop, Bottom side on small screens) */}
          <div className="absolute -right-16 bottom-12 hidden flex-col items-center gap-6 lg:flex">
            <ShortAction icon={<ThumbsUp fill="currentColor" />} label="高評価" />
            <ShortAction icon={<ThumbsDown />} label="低評価" />
            <ShortAction icon={<MessageSquare fill="currentColor" />} label="1.2万" />
            <ShortAction icon={<Share2 fill="currentColor" />} label="共有" />
            <ShortAction icon={<MoreVertical />} label="" />
            <div className="mt-4 h-10 w-10 overflow-hidden rounded-lg border-2 border-white/20 ring-1 ring-black">
              <img src={proxyImageUrl(detail?.thumbnail)} alt="" className="h-full w-full object-cover blur-sm opacity-50" />
            </div>
          </div>
        </div>
        
        {/* Navigation Arrows (Desktop) */}
        <div className="absolute right-8 top-1/2 -translate-y-1/2 hidden flex-col gap-4 lg:flex">
           <button className="rounded-full bg-white/5 p-3 hover:bg-white/10 transition-colors">
             <ChevronUp size={28} />
           </button>
           <button className="rounded-full bg-white/5 p-3 hover:bg-white/10 transition-colors">
             <ChevronDown size={28} />
           </button>
        </div>
      </div>
      
      {/* Mobile Actions Overlay */}
      <div className="absolute right-4 bottom-32 flex flex-col items-center gap-6 lg:hidden z-30">
        <ShortAction icon={<ThumbsUp fill="currentColor" />} label="12万" shadow />
        <ShortAction icon={<ThumbsDown />} label="低評価" shadow />
        <ShortAction icon={<MessageSquare fill="currentColor" />} label="345" shadow />
        <ShortAction icon={<Share2 fill="currentColor" />} label="共有" shadow />
      </div>
    </div>
  );
}

function ShortAction({ icon, label, shadow }: { icon: React.ReactNode, label: string, shadow?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1.5 group">
      <button className={cn(
        "h-12 w-12 rounded-full flex items-center justify-center transition-all active:scale-90",
        shadow ? "bg-black/20 backdrop-blur-md" : "bg-white/10 hover:bg-white/20"
      )}>
        {icon}
      </button>
      <span className="text-[11px] font-bold text-white drop-shadow-md">{label}</span>
    </div>
  );
}
