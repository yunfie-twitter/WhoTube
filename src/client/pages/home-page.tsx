import { useEffect, useMemo, useState, useRef } from 'react';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { getPopular, getTrending, searchVideos, getHomeFeed } from '../lib/api';
import { VideoGrid } from '../components/video/video-grid';
import { cn } from '../lib/utils';
import type { VideoItem } from '../lib/types';
import { getRegion, getRegionLabel, getDefaultHomeCategory } from '../lib/settings';
import { useAuth } from '../lib/auth';
import { getSubscriptionsFeed } from '../lib/subscriptions';

export const categories = [
  'すべて', '音楽', 'ミックス', 'ゲーム', 'ポッドキャスト', 'ライブ',
  'チャンネル登録済み', '最近アップロードされた動画', 'アニメーション', 'ボカロ', '料理', 'サッカー',
  '視聴済み', '新しい動画の発見'
];

const searchCategories: Record<string, string> = {
  '音楽': 'music',
  'ミックス': 'mix playlist',
  'ゲーム': 'gaming',
  'ポッドキャスト': 'podcast',
  'ライブ': 'live',
  'アニメーション': 'animation',
  'ボカロ': 'vocaloid',
  '料理': 'cooking',
  'サッカー': 'soccer'
};

function readWatchedVideos(): VideoItem[] {
  try {
    const raw = window.localStorage.getItem('whotube:watched-videos');
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function HomePage() {
  const auth = useAuth();
  const owner = { isAuthenticated: auth.isAuthenticated && Boolean(auth.user?.id), userId: auth.user?.id };
  const [activeCategory, setActiveCategory] = useState(() => getDefaultHomeCategory());
  const [watchedVersion, setWatchedVersion] = useState(0);
  const [region, setRegionState] = useState(() => getRegion());
  const regionLabel = getRegionLabel(region);

  const subscriptionsQuery = useQuery({
    queryKey: ['home-subscriptions', owner.isAuthenticated ? owner.userId : 'local'],
    queryFn: () => import('../lib/subscriptions').then(m => m.listSubscriptions(owner))
  });
  const subCount = subscriptionsQuery.data?.length || 0;
  const showSubRowOnHome = subCount > 0;

  useEffect(() => {
    const onSettingsChanged = () => setRegionState(getRegion());
    window.addEventListener('whotube:settings-changed', onSettingsChanged);
    window.addEventListener('storage', onSettingsChanged);
    return () => {
      window.removeEventListener('whotube:settings-changed', onSettingsChanged);
      window.removeEventListener('storage', onSettingsChanged);
    };
  }, []);

  const trending = useQuery({
    queryKey: ['trending', region],
    queryFn: async () => {
      const res = await getTrending(24, 0, region);
      return res.items;
    }
  });

  const popular = useQuery({
    queryKey: ['popular', region],
    queryFn: async () => {
      const res = await getPopular(24, 0, region);
      return res.items;
    }
  });

  const subscriptionFeed = useQuery({
    queryKey: ['home-subscription-feed-static', owner.isAuthenticated ? owner.userId : 'local'],
    queryFn: () => getSubscriptionsFeed(owner, 48),
    enabled: activeCategory === 'すべて' && showSubRowOnHome && !auth.isLoading
  });

  const randomizedSubFeed = useMemo(() => {
    if (!subscriptionFeed.data) return [];
    const items = [...subscriptionFeed.data];
    // Fisher-Yates shuffle
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  }, [subscriptionFeed.data]);

  const categoryQuery = useInfiniteQuery({
    queryKey: ['home-category-infinite', activeCategory, region, owner.userId],
    queryFn: async ({ pageParam }) => {
      if (activeCategory === 'すべて' || activeCategory === '視聴済み') return { items: [] as VideoItem[], nextParam: null };

      if (activeCategory === '最近アップロードされた動画') {
        const res = await searchVideos(`${regionLabel} 最近の動画`, { 
          sort: 'upload_date',
          continuation: pageParam as string 
        });
        return { items: res.items, nextParam: res.continuation };
      }

      if (activeCategory === 'チャンネル登録済み') {
        const offset = typeof pageParam === 'number' ? pageParam : 0;
        const items = await getSubscriptionsFeed(owner, 40, offset);
        return { items, nextParam: items.length === 40 ? offset + 40 : null };
      }

      if (activeCategory === '新しい動画の発見') {
        if (region === 'JP') {
          const offset = typeof pageParam === 'number' ? pageParam : 0;
          const res = await getPopular(48, offset);
          return { items: res.items, nextParam: res.nextOffset };
        } else {
          const res = await searchVideos(`${regionLabel} new videos`, { continuation: pageParam as string });
          return { items: res.items, nextParam: res.continuation };
        }
      }

      if (searchCategories[activeCategory]) {
        const q = `${regionLabel} ${searchCategories[activeCategory]}`;
        if (!pageParam) {
          const [relevance, recent, popularResults] = await Promise.all([
            searchVideos(q, { sort: 'relevance' }),
            searchVideos(q, { sort: 'upload_date' }),
            searchVideos(q, { sort: 'view_count' })
          ]);

          const merged: VideoItem[] = [];
          const maxLength = Math.max(relevance.items.length, recent.items.length, popularResults.items.length);
          for (let i = 0; i < maxLength; i++) {
            if (relevance.items[i]) merged.push(relevance.items[i]);
            if (recent.items[i]) merged.push(recent.items[i]);
            if (popularResults.items[i]) merged.push(popularResults.items[i]);
          }

          const seen = new Set<string>();
          const unique = merged.filter(v => {
            if (seen.has(v.id)) return false;
            seen.add(v.id);
            return true;
          });

          const topCount = 48;
          const head = unique.slice(0, topCount);
          const tail = unique.slice(topCount);
          for (let i = head.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [head[i], head[j]] = [head[j], head[i]];
          }

          return { items: [...head, ...tail], nextParam: relevance.continuation };
        } else {
          const res = await searchVideos(q, { continuation: pageParam as string });
          return { items: res.items, nextParam: res.continuation };
        }
      }

      return { items: [] as VideoItem[], nextParam: null };
    },
    initialPageParam: null as string | number | null,
    getNextPageParam: (lastPage) => lastPage.nextParam,
    enabled: activeCategory !== 'すべて' && activeCategory !== '視聴済み'
  });

  const homeFeed = useInfiniteQuery({
    queryKey: ['home-feed', region, owner.userId],
    queryFn: ({ pageParam }) => getHomeFeed(pageParam as string),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.continuation,
    enabled: activeCategory === 'すべて'
  });

  const recentUploadsForHome = useQuery({
    queryKey: ['recent-uploads-home', region],
    queryFn: async () => {
      const res = await searchVideos(`${regionLabel} 最近の動画`, { sort: 'upload_date' });
      return res.items;
    },
    enabled: activeCategory === 'すべて' && !homeFeed.data
  });

  const watchedVideos = useMemo(() => readWatchedVideos(), [watchedVersion]);

  const activeItems = activeCategory === '視聴済み' 
    ? watchedVideos 
    : (categoryQuery.data?.pages.flatMap(p => p.items) ?? []);
    
  const activeLoading = categoryQuery.isLoading;

  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = () => {
    const el = scrollRef.current;
    if (el) {
      setCanScrollLeft(el.scrollLeft > 1);
      setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
    }
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, []);

  const observerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const hasNext = activeCategory === 'すべて' ? homeFeed.hasNextPage : categoryQuery.hasNextPage;
    const isFetching = activeCategory === 'すべて' ? homeFeed.isFetchingNextPage : categoryQuery.isFetchingNextPage;
    
    if (!hasNext || isFetching) return;
    
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        if (activeCategory === 'すべて') {
          homeFeed.fetchNextPage();
        } else {
          categoryQuery.fetchNextPage();
        }
      }
    }, { threshold: 0.1 });

    if (observerRef.current) {
      observer.observe(observerRef.current);
    }

    return () => observer.disconnect();
  }, [
    categoryQuery.hasNextPage, categoryQuery.isFetchingNextPage, categoryQuery.fetchNextPage,
    homeFeed.hasNextPage, homeFeed.isFetchingNextPage, homeFeed.fetchNextPage,
    activeCategory
  ]);

  function onCategoryClick(category: string) {
    setActiveCategory(category);
    if (category === '視聴済み') {
      setWatchedVersion((value) => value + 1);
    }
  }

  function scroll(direction: 'left' | 'right') {
    const el = scrollRef.current;
    if (el) {
      const amount = el.clientWidth * 0.75;
      el.scrollBy({
        left: direction === 'left' ? -amount : amount,
        behavior: 'smooth'
      });
    }
  }

  return (
    <div className="space-y-6">
      {/* Category Chips */}
      <div className="sticky top-14 z-20 -mx-4 flex items-center bg-zinc-50/95 dark:bg-[#0f0f0f]/95 px-4 py-3 backdrop-blur group/categories transition-colors duration-300">
        {canScrollLeft && (
          <div className="absolute left-4 z-10 flex h-full items-center bg-gradient-to-r from-zinc-50 via-zinc-50 to-transparent dark:from-[#0f0f0f] dark:via-[#0f0f0f] pr-8 transition-colors duration-300">
            <button
              onClick={() => scroll('left')}
              className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800"
            >
              <ChevronLeft size={24} />
            </button>
          </div>
        )}
        
        <div 
          ref={scrollRef}
          onScroll={checkScroll}
          className="flex gap-3 overflow-x-auto no-scrollbar scroll-smooth"
        >
          {categories.map((cat, i) => (
            <button
              key={cat}
              type="button"
              onClick={() => onCategoryClick(cat)}
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
          <div className="absolute right-4 z-10 flex h-full items-center bg-gradient-to-l from-zinc-50 via-zinc-50 to-transparent dark:from-[#0f0f0f] dark:via-[#0f0f0f] pl-8 transition-colors duration-300">
            <button
              onClick={() => scroll('right')}
              className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800"
            >
              <ChevronRight size={24} />
            </button>
          </div>
        )}
      </div>

      {/* Main Grid */}
      <div className="space-y-12 pt-2">
        {activeCategory !== 'すべて' ? (
          <section>
            {activeLoading ? (
              <div className="grid grid-cols-1 gap-x-4 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="animate-pulse space-y-3">
                    <div className="aspect-video rounded-xl bg-zinc-200 dark:bg-zinc-800" />
                    <div className="flex gap-3">
                      <div className="h-9 w-9 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 rounded bg-zinc-200 dark:bg-zinc-800" />
                        <div className="h-3 w-2/3 rounded bg-zinc-200 dark:bg-zinc-800" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : activeItems.length ? (
              <>
                <VideoGrid items={activeItems} />
                {categoryQuery.hasNextPage && (
                  <div ref={observerRef} className="py-12 flex flex-col items-center justify-center gap-4">
                    <Loader2 className="animate-spin text-zinc-400" size={32} />
                    <p className="text-sm text-zinc-500">さらに読み込んでいます...</p>
                  </div>
                )}
              </>
            ) : (
              <p className="py-12 text-center text-sm text-zinc-500">表示できる動画がありません。</p>
            )}
          </section>
        ) : (
          <div className="space-y-12">
            {showSubRowOnHome && randomizedSubFeed.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-zinc-900 dark:text-white">登録チャンネルの最新動画</h2>
                  <button onClick={() => setActiveCategory('チャンネル登録済み')} className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline">すべて見る</button>
                </div>
                <VideoGrid items={randomizedSubFeed.slice(0, 12)} />
              </section>
            )}

            {homeFeed.isLoading ? (
               <div className="space-y-12">
                 {[...Array(3)].map((_, idx) => (
                   <section key={idx} className="space-y-4">
                      <div className="h-6 w-48 rounded bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
                      <div className="grid grid-cols-1 gap-x-4 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                        {[...Array(4)].map((_, i) => (
                          <div key={i} className="animate-pulse space-y-3">
                            <div className="aspect-video rounded-xl bg-zinc-200 dark:bg-zinc-800" />
                            <div className="h-4 rounded bg-zinc-200 dark:bg-zinc-800 w-3/4" />
                          </div>
                        ))}
                      </div>
                   </section>
                 ))}
               </div>
            ) : (
              homeFeed.data?.pages.flatMap(page => page.shelves).map((shelf, sIdx) => (
                <section key={`${shelf.title}-${sIdx}`} className="space-y-4">
                  <h2 className="text-xl font-bold text-zinc-900 dark:text-white">{shelf.title}</h2>
                  <VideoGrid items={shelf.items} />
                </section>
              ))
            )}

            {/* Fallback sections if homeFeed is empty or fails */}
            {!homeFeed.isLoading && (!homeFeed.data || homeFeed.data.pages[0].shelves.length === 0) && (
              <>
                <section className="space-y-4">
                  <h2 className="text-xl font-bold text-zinc-900 dark:text-white">急上昇</h2>
                  {trending.isLoading ? (
                    <div className="grid grid-cols-1 gap-x-4 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                      {[...Array(8)].map((_, i) => (
                        <div key={i} className="animate-pulse space-y-3">
                          <div className="aspect-video rounded-xl bg-zinc-200 dark:bg-zinc-800" />
                          <div className="flex gap-3">
                            <div className="h-9 w-9 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                            <div className="flex-1 space-y-2">
                              <div className="h-4 rounded bg-zinc-200 dark:bg-zinc-800" />
                              <div className="h-3 w-2/3 rounded bg-zinc-200 dark:bg-zinc-800" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <VideoGrid items={trending.data ?? []} />
                  )}
                </section>

                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-zinc-900 dark:text-white">最近の動画</h2>
                    <button onClick={() => setActiveCategory('最近アップロードされた動画')} className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline">すべて見る</button>
                  </div>
                  {recentUploadsForHome.isLoading ? (
                    <div className="grid grid-cols-1 gap-x-4 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                      {[...Array(4)].map((_, i) => (
                        <div key={i} className="animate-pulse space-y-3">
                          <div className="aspect-video rounded-xl bg-zinc-200 dark:bg-zinc-800" />
                          <div className="flex-1 space-y-2">
                            <div className="h-4 rounded bg-zinc-200 dark:bg-zinc-800" />
                            <div className="h-3 w-2/3 rounded bg-zinc-200 dark:bg-zinc-800" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <VideoGrid items={(recentUploadsForHome.data ?? []).slice(0, 8)} />
                  )}
                </section>

                <section className="space-y-4">
                  <h2 className="text-xl font-bold text-zinc-900 dark:text-white">人気</h2>
                  <VideoGrid items={popular.data ?? []} />
                </section>
              </>
            )}

            {(homeFeed.hasNextPage || homeFeed.isFetchingNextPage) && (
               <div ref={observerRef} className="py-12 flex flex-col items-center justify-center gap-4">
                 <Loader2 className="animate-spin text-zinc-400" size={32} />
                 <p className="text-sm text-zinc-500">さらに読み込んでいます...</p>
               </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
