import { QueueManager } from '../../lib/queue';
import { useEffect, useState } from 'react';
import { Play, ListMusic, ChevronDown, ChevronUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { proxyImageUrl } from '../../lib/images';

export function PlaybackQueue() {
  const [queue, setQueue] = useState(QueueManager.state);
  const [isExpanded, setIsExpanded] = useState(true);

  useEffect(() => {
    const handleQueueChange = () => {
      setQueue({ ...QueueManager.state });
    };
    window.addEventListener('whotube:queue-changed', handleQueueChange);
    return () => window.removeEventListener('whotube:queue-changed', handleQueueChange);
  }, []);

  if (queue.items.length === 0) return null;

  const currentVideo = queue.items[queue.currentIndex];

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/50">
      <div 
        className="flex cursor-pointer items-center justify-between bg-zinc-100 p-3 dark:bg-zinc-800"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <ListMusic size={18} className="text-blue-600 dark:text-blue-400" />
          <span className="text-sm font-bold">再生キュー ({queue.currentIndex + 1} / {queue.items.length})</span>
        </div>
        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </div>

      {isExpanded && (
        <div 
          className="no-scrollbar flex max-h-[400px] flex-col overflow-y-auto p-2"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {queue.items.map((video, index) => (
            <Link
              key={`${video.id}-${index}`}
              to={`/watch/${video.id}?autoplay=1`}
              onClick={() => QueueManager.jumpTo(index)}
              className={cn(
                "group flex items-center gap-3 rounded-lg p-2 transition-colors",
                index === queue.currentIndex 
                  ? "bg-blue-50 dark:bg-blue-900/20" 
                  : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
              )}
            >
              <div className="relative aspect-video w-24 shrink-0 overflow-hidden rounded-md bg-zinc-200 dark:bg-zinc-800">
                <img 
                  src={proxyImageUrl(video.thumbnail)} 
                  alt={video.title} 
                  className="h-full w-full object-cover"
                />
                {index === queue.currentIndex && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <Play className="fill-white text-white" size={16} />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className={cn(
                  "line-clamp-2 text-xs font-bold leading-tight",
                  index === queue.currentIndex ? "text-blue-600 dark:text-blue-400" : "text-zinc-900 dark:text-zinc-100"
                )}>
                  {video.title}
                </p>
                <p className="mt-1 truncate text-[10px] text-zinc-500 dark:text-zinc-400">
                  {video.channelTitle}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
