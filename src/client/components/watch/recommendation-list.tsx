import { Link } from 'react-router-dom';
import { proxyImageUrl } from '../../lib/images';
import { cn } from '../../lib/utils';

export function RecommendationSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <div 
        className="flex gap-2 overflow-x-auto overflow-y-hidden pb-1 no-scrollbar"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-7 w-20 shrink-0 rounded-lg bg-zinc-200/60 dark:bg-zinc-800/60" />
        ))}
      </div>
      <div className="flex flex-col gap-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex animate-pulse gap-2">
            <div className="aspect-video w-[168px] shrink-0 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
            <div className="flex flex-1 flex-col gap-2 py-1">
              <div className="h-4 w-full rounded bg-zinc-200 dark:bg-zinc-800" />
              <div className="h-3.5 w-3/4 rounded bg-zinc-200/80 dark:bg-zinc-800/80" />
              <div className="mt-auto h-3 w-1/2 rounded bg-zinc-200/60 dark:bg-zinc-800/60" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface RecommendationListProps {
  videoTitle: string;
  id: string;
  author: string;
  recommendationTab: 'all' | 'related' | 'channel';
  setRecommendationTab: (tab: 'all' | 'related' | 'channel') => void;
  recommendedVideos: any[];
  markAutoplayIntent: () => void;
  isLoading: boolean;
}

export function RecommendationList({ 
  author, 
  recommendationTab, 
  setRecommendationTab, 
  recommendedVideos, 
  markAutoplayIntent,
  isLoading
}: RecommendationListProps) {
  if (isLoading) {
    return <RecommendationSkeleton />;
  }

  return (
    <div className="flex flex-col gap-3 overflow-x-hidden overflow-y-hidden no-scrollbar animate-in fade-in duration-1000">
      <div 
        className="flex gap-2 overflow-x-auto overflow-y-hidden pb-1 no-scrollbar"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {[
          { id: 'all', label: 'すべて' },
          { id: 'related', label: '関連動画' },
          { id: 'channel', label: (author && author !== 'N/A' ? author : 'チャンネル') }
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setRecommendationTab(tab.id as 'all' | 'related' | 'channel')}
            className={cn(
              "shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold transition-all",
              recommendationTab === tab.id 
                ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-950" 
                : "bg-zinc-200 text-zinc-700 hover:bg-zinc-300 dark:bg-white/10 dark:text-zinc-100 dark:hover:bg-white/20"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        {recommendedVideos.map((video: any) => {
          const displayChannelTitle = video.channelTitle === 'N/A' ? '' : video.channelTitle;
          return (
            <Link 
              key={video.id} 
              to={`/watch/${video.id}?autoplay=1`} 
              className="group flex gap-2" 
              onPointerDown={markAutoplayIntent}
            >
              <div className="relative aspect-video w-[168px] shrink-0 overflow-hidden rounded-lg bg-zinc-200 dark:bg-zinc-800">
                {video.thumbnail ? (
                  <img 
                    src={proxyImageUrl(video.thumbnail)} 
                    alt={video.title} 
                    className="h-full w-full object-cover transition-transform group-hover:scale-105" 
                    loading="lazy"
                    decoding="async"
                  />
                ) : null}
                {video.durationText && (
                  <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1 text-[10px] font-bold text-white">
                    {video.durationText}
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-0.5 min-w-0">
                <p className="line-clamp-2 text-sm font-bold leading-tight text-zinc-900 dark:text-zinc-100">
                  {video.title}
                </p>
                <div className="flex flex-col">
                  {video.channelId && video.channelId !== 'N/A' ? (
                    <Link to={`/channel/${video.channelId}`} className="truncate text-xs text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200">
                      {displayChannelTitle}
                    </Link>
                  ) : (
                    <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{displayChannelTitle}</p>
                  )}
                  <p className="truncate text-[11px] text-zinc-400 dark:text-zinc-500">
                    {[video.viewCountText, video.publishedText].filter(Boolean).join(' ・ ')}
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
