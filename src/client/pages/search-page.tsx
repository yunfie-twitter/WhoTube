import { useState, useRef, useEffect, useMemo } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { searchVideos, SearchFilters as SearchFiltersType } from '../lib/api';
import { cn } from '../lib/utils';
import { ChannelAvatar } from '../components/video/channel-avatar';
import { addHistoryItem, readHistory } from '../lib/history';
import { proxyImageUrl } from '../lib/images';
import { ErrorPage } from './error-page';
import { SearchFilters } from '../components/search/search-filters';
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react';

const searchCategories = [
  'すべて', '動画', 'ショート', '最近アップロードされた動画', 'ライブ', '未視聴', '視聴済み'
];

const categoryFilterMap: Record<string, SearchFiltersType> = {
  'すべて': {},
  '動画': { type: 'video' },
  'ショート': { type: 'video', duration: 'short' },
  '最近アップロードされた動画': { sort: 'upload_date' },
  'ライブ': { features: ['live'] },
  '未視聴': {}, // Logic for these might need backend support or local filtering
  '視聴済み': {},
};

export function SearchPage() {
  const [params] = useSearchParams();
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<SearchFiltersType>({});
  const [activeCategory, setActiveCategory] = useState('すべて');
  const q = params.get('q') ?? '';

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
  } = useInfiniteQuery({
    queryKey: ['search', q, filters, activeCategory],
    queryFn: async ({ pageParam }) => {
      const categoryFilter = categoryFilterMap[activeCategory] || {};
      const res = await searchVideos(q, { 
        ...filters, 
        ...categoryFilter,
        continuation: pageParam 
      });
      return res;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.continuation,
    enabled: q.length > 0
  });

  const observerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage) return;
    
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        fetchNextPage();
      }
    }, { threshold: 0.1 });

    if (observerRef.current) {
      observer.observe(observerRef.current);
    }

    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (!q) {
    return <p className="text-sm text-zinc-500">検索ワードを入力してください。</p>;
  }

  if (isError) {
    return <ErrorPage type="network" title="検索に失敗しました" />;
  }

  const items = useMemo(() => {
    const rawItems = data?.pages.flatMap(page => page.items) ?? [];
    if (activeCategory === '未視聴') {
      const history = readHistory();
      const historyIds = new Set(history.map(h => h.id));
      return rawItems.filter(item => !historyIds.has(item.id));
    }
    if (activeCategory === '視聴済み') {
      const history = readHistory();
      const historyIds = new Set(history.map(h => h.id));
      return rawItems.filter(item => historyIds.has(item.id));
    }
    return rawItems;
  }, [data, activeCategory]);

  const categoryScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = () => {
    const el = categoryScrollRef.current;
    if (el) {
      setCanScrollLeft(el.scrollLeft > 1);
      setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
    }
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [items]);

  const scrollCategories = (direction: 'left' | 'right') => {
    if (categoryScrollRef.current) {
      const amount = categoryScrollRef.current.clientWidth * 0.6;
      categoryScrollRef.current.scrollBy({
        left: direction === 'left' ? -amount : amount,
        behavior: 'smooth'
      });
    }
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      {/* Search Header / Filters */}
      <div className="sticky top-14 z-20 -mx-4 flex items-center justify-between bg-zinc-50/95 dark:bg-[#0f0f0f]/95 px-4 py-3 backdrop-blur border-b border-zinc-200 dark:border-zinc-800 transition-colors duration-300">
        <div className="relative flex flex-1 items-center overflow-hidden">
          {canScrollLeft && (
            <div className="absolute left-0 z-10 flex h-full items-center bg-gradient-to-r from-zinc-50 via-zinc-50 to-transparent dark:from-[#0f0f0f] dark:via-[#0f0f0f] pr-6 transition-colors duration-300">
              <button
                onClick={() => scrollCategories('left')}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/80 shadow-sm hover:bg-zinc-200 dark:bg-zinc-800/80 dark:hover:bg-zinc-700"
              >
                <ChevronLeft size={18} />
              </button>
            </div>
          )}

          <div 
            ref={categoryScrollRef}
            onScroll={checkScroll}
            className="flex gap-3 overflow-x-auto no-scrollbar scroll-smooth"
          >
            {searchCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  'shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold transition',
                  activeCategory === cat 
                    ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950' 
                    : 'bg-zinc-200 text-zinc-700 hover:bg-zinc-300 dark:bg-[#272727] dark:text-zinc-100 dark:hover:bg-[#3f3f3f]'
                )}
              >
                {cat}
              </button>
            ))}
          </div>

          {canScrollRight && (
            <div className="absolute right-0 z-10 flex h-full items-center bg-gradient-to-l from-zinc-50 via-zinc-50 to-transparent dark:from-[#0f0f0f] dark:via-[#0f0f0f] pl-6 transition-colors duration-300">
              <button
                onClick={() => scrollCategories('right')}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/80 shadow-sm hover:bg-zinc-200 dark:bg-zinc-800/80 dark:hover:bg-zinc-700"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          )}
        </div>
        
        <button 
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            "ml-4 flex shrink-0 items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors",
            showFilters 
              ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-950" 
              : "text-zinc-600 hover:bg-zinc-100 dark:text-white dark:hover:bg-[#272727]"
          )}
        >
          <span>フィルタ</span>
          <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current"><path d="M15 17h6v1h-6v-1zm-2-9h8v1h-8V8zm-2 9h1v1h-1v-1zm2-1h-3v3h3v-3zm9-4h-6v1h6v-1zm-2-1h-3v3h3v-3zm-12 1h-8v1h8v-1zm2-1h-3v3h3v-3zM1 8h6v1H1V8zm2-1h3v3H3V7zm3 10H1v1h5v-1zm-1-1h3v3h-3v-3z"/></svg>
        </button>
      </div>

      {showFilters && (
        <SearchFilters 
          onClose={() => setShowFilters(false)} 
          onApply={(newFilters) => setFilters(prev => ({ ...prev, ...newFilters }))}
        />
      )}

      {/* Search Results List */}
      <div className="mt-2 space-y-4 px-4 sm:px-0">
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex animate-pulse gap-4">
                <div className="aspect-video w-full max-w-[360px] rounded-xl bg-zinc-200 dark:bg-zinc-800" />
                <div className="flex-1 space-y-3 py-2">
                  <div className="h-5 w-3/4 rounded bg-zinc-200 dark:bg-zinc-800" />
                  <div className="h-3 w-1/4 rounded bg-zinc-200 dark:bg-zinc-800" />
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                    <div className="h-3 w-32 rounded bg-zinc-200 dark:bg-zinc-800" />
                  </div>
                  <div className="h-3 w-full rounded bg-zinc-200 dark:bg-zinc-800" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {items.map((item, idx) => {
              const isChannel = item.type === 'channel';
              const isPlaylist = item.type === 'playlist';
              const isMovie = item.type === 'movie';
              const targetPath = isChannel ? `/channel/${item.id}` : isPlaylist ? `/playlist/${item.id}` : `/watch/${item.id}?autoplay=1`;

              return (
                <Link
                  key={`${item.id}-${idx}`}
                  to={targetPath}
                  onPointerDown={() => !isChannel && !isPlaylist && addHistoryItem(item)}
                  className="group flex flex-col gap-4 sm:flex-row"
                >
                  <div className={cn(
                    "relative aspect-video w-full shrink-0 overflow-hidden bg-zinc-200 dark:bg-zinc-800 sm:max-w-[360px]",
                    isChannel ? "rounded-full max-w-[120px] mx-auto sm:mx-0 sm:max-w-[120px] aspect-square" : "rounded-xl"
                  )}>
                    <img
                      src={proxyImageUrl(item.thumbnail)}
                      alt=""
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      loading="lazy"
                    />
                    {item.durationText && !isChannel && (
                      <span className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-xs font-semibold text-white">
                        {item.durationText}
                      </span>
                    )}
                  </div>
                  <div className={cn(
                    "flex min-w-0 flex-1 flex-col py-1",
                    isChannel ? "justify-center" : ""
                  )}>
                    <h3 className={cn(
                      "line-clamp-2 font-bold text-zinc-900 group-hover:text-blue-600 dark:text-zinc-100 dark:group-hover:text-white transition-colors",
                      isChannel ? "text-xl" : "text-lg"
                    )}>
                      {item.title}
                    </h3>
                    <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                      {isChannel ? (
                        <>
                          <span>チャンネル</span>
                          {item.viewCountText && (
                            <>
                              <span className="mx-1">•</span>
                              <span>{item.viewCountText}</span>
                            </>
                          )}
                        </>
                      ) : (
                        <>
                          <span>{item.viewCountText}</span>
                          <span className="mx-1">•</span>
                          <span>{item.publishedText}</span>
                        </>
                      )}
                    </div>
                    {!isChannel && (
                      <div className="mt-3 flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors text-left">
                        <ChannelAvatar channelId={item.channelId} src={item.channelThumbnail} title={item.channelTitle} sizeClassName="h-6 w-6" />
                        <span className="truncate">{item.channelTitle}</span>
                      </div>
                    )}
                    {item.description ? (
                      <p className="mt-3 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-500">{item.description}</p>
                    ) : null}
                  </div>
                </Link>
              );
            })}

            {hasNextPage && (
              <div ref={observerRef} className="py-12 flex flex-col items-center justify-center gap-4">
                <Loader2 className="animate-spin text-zinc-400" size={32} />
                <p className="text-sm text-zinc-500">さらに読み込んでいます...</p>
              </div>
            )}

            {!hasNextPage && items.length > 0 && (
              <p className="py-12 text-center text-sm text-zinc-500">これ以上の結果はありません。</p>
            )}
            
            {items.length === 0 && !isLoading && (
              <p className="py-12 text-center text-sm text-zinc-500">検索結果が見つかりませんでした。</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
