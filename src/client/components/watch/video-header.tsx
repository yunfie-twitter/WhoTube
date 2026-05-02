import { Bell, Download, MoreHorizontal, Save, Share2, Terminal, ThumbsDown, ThumbsUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../ui/button';
import { proxyImageUrl } from '../../lib/images';
import { cn } from '../../lib/utils';

interface VideoHeaderProps {
  videoId: string;
  title: string;
  author: string;
  channelId: string;
  channelThumbnail?: string;
  subscriberCount?: string;
  likeCount?: number | null;
  onSubscribe: () => void | Promise<void>;
  onShare: () => void;
  onSave: () => void;
  onOffline: () => void;
  isDownloading?: boolean;
  downloadProgress?: number;
  isDownloaded?: boolean;
  onRatingPrompt: () => void;
  isForcedChannel?: boolean;
  className?: string;
}

const DEVELOPER_CHANNEL_ID = 'UCfjIuWCkkuDGRs1NL4smgyg';

export function VideoHeader({
  videoId,
  title,
  author,
  channelId,
  channelThumbnail,
  subscriberCount,
  likeCount,
  onSubscribe,
  onShare,
  onSave,
  onOffline,
  isDownloading,
  downloadProgress,
  isDownloaded,
  onRatingPrompt,
  isForcedChannel,
  className
}: VideoHeaderProps) {
  return (
    <div className={cn("space-y-3 text-zinc-900 dark:text-zinc-100", className)}>
      <h1 className="text-lg font-bold leading-tight tracking-tight text-zinc-900 dark:text-white md:text-xl">{title || videoId}</h1>
      <div className="flex flex-wrap items-center justify-between gap-y-4">
        <div className="flex min-w-0 items-center gap-3">
          {channelThumbnail ? (
            <img 
              src={proxyImageUrl(channelThumbnail)} 
              alt={author} 
              className="h-9 w-9 rounded-full bg-zinc-200 dark:bg-zinc-800 object-cover ring-1 ring-black/5 dark:ring-white/5 transition-transform hover:scale-105 md:h-10 md:w-10" 
            />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-800 text-sm font-semibold text-zinc-900 dark:text-white md:h-10 md:w-10">
              {(author || '?').slice(0, 1)}
            </div>
          )}
          <div className="min-w-0">
            {channelId ? (
              <Link className="flex items-center gap-2 truncate text-xs font-bold text-zinc-900 dark:text-white hover:underline md:text-sm" to={`/channel/${channelId}`}>
                {author || 'Unknown channel'}
                {channelId === DEVELOPER_CHANNEL_ID && (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-tighter text-white shadow-sm ring-1 ring-white/10">
                    <Terminal size={10} />
                    開発者
                  </span>
                )}
              </Link>
            ) : (
              <div className="flex items-center gap-2 truncate text-xs font-bold text-zinc-900 dark:text-white md:text-sm">
                {author || 'Unknown channel'}
                {channelId === DEVELOPER_CHANNEL_ID && (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-tighter text-white shadow-sm ring-1 ring-white/10">
                    <Terminal size={10} />
                    開発者
                  </span>
                )}
              </div>
            )}
            <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
              {subscriberCount ? `${subscriberCount} 登録者` : '登録者数 非公開'}
            </p>
          </div>
          {!isForcedChannel && (
            <Button 
              size="sm" 
              className="ml-4 h-9 gap-2 rounded-full bg-zinc-900 px-4 text-sm font-extrabold text-white transition-all hover:bg-zinc-800 active:scale-95 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200" 
              onClick={onSubscribe}
            >
              登録
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-full bg-zinc-200 dark:bg-white/10 p-0.5 ring-1 ring-black/5 dark:ring-white/5">
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 gap-2 rounded-l-full rounded-r-none px-4 text-zinc-900 dark:text-zinc-100 hover:bg-black/5 dark:hover:bg-white/10" 
              onClick={onRatingPrompt}
            >
              <ThumbsUp size={19} />
              <span className="font-bold">
                {likeCount ? new Intl.NumberFormat('ja-JP', { notation: 'compact' }).format(likeCount) : '高評価'}
              </span>
            </Button>
            <div className="h-5 w-px bg-black/10 dark:bg-white/20" />
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-11 rounded-l-none rounded-r-full text-zinc-900 dark:text-zinc-100 hover:bg-black/5 dark:hover:bg-white/10" 
              onClick={onRatingPrompt}
            >
              <ThumbsDown size={19} />
            </Button>
          </div>

          <Button 
            variant="secondary" 
            size="sm" 
            className="h-9 gap-2 rounded-full bg-zinc-200 dark:bg-white/10 px-4 font-extrabold text-zinc-900 dark:text-zinc-100 hover:bg-zinc-300 dark:hover:bg-white/20 ring-1 ring-black/5 dark:ring-white/5" 
            onClick={onShare}
          >
            <Share2 size={19} />
            共有
          </Button>

          <Button 
            variant="secondary" 
            size="sm" 
            className="h-9 gap-2 rounded-full bg-zinc-200 dark:bg-white/10 px-4 font-extrabold text-zinc-900 dark:text-zinc-100 hover:bg-zinc-300 dark:hover:bg-white/20 ring-1 ring-black/5 dark:ring-white/5" 
            onClick={onSave}
          >
            <Save size={19} />
            保存
          </Button>

          <Button 
            variant="secondary" 
            size="sm" 
            disabled={isDownloading}
            className={cn(
              "h-9 gap-2 rounded-full px-4 font-extrabold transition-all ring-1 ring-black/5 dark:ring-white/5",
              isDownloaded 
                ? "bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50"
                : "bg-zinc-200 text-zinc-900 hover:bg-zinc-300 dark:bg-white/10 dark:text-zinc-100 dark:hover:bg-white/20"
            )}
            onClick={onOffline}
          >
            {isDownloading ? (
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-400 border-t-zinc-800 dark:border-zinc-600 dark:border-t-zinc-200" />
                <span className="text-[10px] tabular-nums">{Math.round(downloadProgress || 0)}%</span>
              </div>
            ) : (
              <>
                <Download size={19} className={cn(isDownloaded && "fill-current")} />
                {isDownloaded ? 'オフライン保存済み' : 'オフライン'}
              </>
            )}
          </Button>

          <Button 
            variant="ghost" 
            size="icon" 
            className="h-9 w-9 rounded-full bg-zinc-200 dark:bg-white/10 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-300 dark:hover:bg-white/20 ring-1 ring-black/5 dark:ring-white/5"
          >
            <MoreHorizontal size={22} />
          </Button>
        </div>
      </div>
    </div>
  );
}
