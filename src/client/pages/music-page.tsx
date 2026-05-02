import { searchTracks, getMusicHomeFeed } from '../lib/api';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Music, Play, Loader2, TrendingUp, Sparkles, Trophy, Tag, ChevronLeft, ChevronRight, LayoutGrid, Disc } from 'lucide-react';
import { VideoGrid } from '../components/video/video-grid';
import { cn } from '../lib/utils';
import { Button } from '../components/ui/button';
import { useNavigate } from 'react-router-dom';
import { QueueManager } from '../lib/queue';

const CATEGORIES = [
  'J-POP', 'アニソン', 'ロック', 'ヒップホップ', 'リラックス', 'カフェ', 'ゲーム', 'ダンス', 'ジャズ', 'クラシック'
];

export function MusicPage() {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Featured Content (Hero)
  const heroQuery = useQuery({
    queryKey: ['music-hero'],
    queryFn: () => searchTracks('最新 人気 MV'),
    staleTime: 1000 * 60 * 60
  });

  // Trending Music
  const trendingQuery = useQuery({
    queryKey: ['music-trending'],
    queryFn: () => searchTracks('日本の音楽 急上昇'),
    staleTime: 1000 * 60 * 30
  });

  // New Releases
  const newReleasesQuery = useQuery({
    queryKey: ['music-new-releases'],
    queryFn: () => searchTracks('最新 ミュージックビデオ'),
    staleTime: 1000 * 60 * 30
  });

  // Category specific search
  const categoryQuery = useQuery({
    queryKey: ['music-category', selectedCategory],
    queryFn: () => searchTracks(`${selectedCategory} MV`),
    enabled: !!selectedCategory
  });

  // Home Feed
  const musicHomeFeed = useInfiniteQuery({
    queryKey: ['music-home-feed'],
    queryFn: ({ pageParam }) => getMusicHomeFeed(pageParam as string),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.continuation,
    enabled: !selectedCategory
  });

  const observerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!musicHomeFeed.hasNextPage || musicHomeFeed.isFetchingNextPage || selectedCategory) return;
    
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        musicHomeFeed.fetchNextPage();
      }
    }, { threshold: 0.1 });

    if (observerRef.current) {
      observer.observe(observerRef.current);
    }

    return () => observer.disconnect();
  }, [musicHomeFeed.hasNextPage, musicHomeFeed.isFetchingNextPage, musicHomeFeed.fetchNextPage, selectedCategory]);

  const allVideos = selectedCategory 
    ? (categoryQuery.data ?? [])
    : (popularQuery.data ?? []);

  const handlePlayMix = () => {
    const mixVideos = allVideos.length > 0 ? allVideos : (trendingQuery.data ?? []);
    if (mixVideos.length > 0) {
      QueueManager.setQueue(mixVideos);
      navigate(`/music/player?v=${mixVideos[0].id}`);
    }
  };

  return (
    <div className="space-y-10 pb-24">
      {/* Hero Section */}
      {!selectedCategory && heroQuery.data?.[0] && (
        <div className="relative h-[400px] w-full overflow-hidden rounded-3xl lg:h-[500px]">
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/40 to-transparent z-10" />
          <img 
            src={heroQuery.data[0].thumbnail} 
            alt="" 
            className="h-full w-full object-cover transition-transform duration-1000 hover:scale-105"
          />
          <div className="absolute inset-0 z-20 flex flex-col justify-end p-8 md:p-12">
            <div className="flex items-center gap-2 text-red-500 font-bold mb-4">
              <Sparkles size={20} />
              <span>FEATURED RELEASE</span>
            </div>
            <h1 className="text-4xl font-black text-white md:text-7xl lg:max-w-2xl leading-tight">
              {heroQuery.data[0].title}
            </h1>
            <p className="mt-4 text-lg text-zinc-300 md:text-2xl font-medium">
              {heroQuery.data[0].channelTitle}
            </p>
            <div className="mt-8 flex gap-4">
              <Button 
                size="lg" 
                className="rounded-full bg-white text-black hover:bg-zinc-200 px-8"
                onClick={() => {
                  QueueManager.setQueue(heroQuery.data!);
                  navigate(`/music/player?v=${heroQuery.data![0].id}`);
                }}
              >
                <Play size={24} fill="currentColor" className="mr-2" />
                今すぐ聴く
              </Button>
              <Button 
                variant="outline" 
                size="lg" 
                className="rounded-full border-white/20 bg-white/5 text-white backdrop-blur-md hover:bg-white/10 px-8"
                onClick={handlePlayMix}
              >
                ミックスを再生
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Category Chips */}
      <div className="no-scrollbar flex gap-2 overflow-x-auto py-4 -mx-4 px-4 sticky top-[56px] z-30 bg-[#0f0f0f]/80 backdrop-blur-xl">
        <button
          onClick={() => setSelectedCategory(null)}
          className={cn(
            "flex items-center gap-2 whitespace-nowrap rounded-full px-5 py-2.5 text-sm font-bold transition-all duration-300",
            selectedCategory === null 
              ? "bg-white text-black shadow-lg shadow-white/10 scale-105" 
              : "bg-white/5 text-white hover:bg-white/10 border border-white/5"
          )}
        >
          <Music size={18} />
          すべて
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={cn(
              "flex items-center gap-2 whitespace-nowrap rounded-full px-5 py-2.5 text-sm font-bold transition-all duration-300",
              selectedCategory === cat 
                ? "bg-white text-black shadow-lg shadow-white/10 scale-105" 
                : "bg-white/5 text-white hover:bg-white/10 border border-white/5"
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {!selectedCategory && (
        <div className="space-y-16">
          {musicHomeFeed.isLoading ? (
             <div className="space-y-12">
               {[...Array(3)].map((_, idx) => (
                 <section key={idx} className="space-y-6">
                    <div className="h-8 w-64 rounded bg-zinc-800 animate-pulse" />
                    <div className="flex gap-4 overflow-hidden">
                      {[...Array(6)].map((_, i) => (
                        <div key={i} className="w-[180px] shrink-0 space-y-3">
                          <div className="aspect-square rounded-2xl bg-zinc-800 animate-pulse" />
                        </div>
                      ))}
                    </div>
                 </section>
               ))}
             </div>
          ) : (
            musicHomeFeed.data?.pages.flatMap(page => page.shelves).map((shelf, sIdx) => (
              <section key={`${shelf.title}-${sIdx}`} className="space-y-6">
                <div className="flex items-center justify-between px-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-white">
                      <Music size={24} />
                    </div>
                    <div>
                      <h2 className="text-2xl font-black text-white md:text-3xl tracking-tight">{shelf.title}</h2>
                    </div>
                  </div>
                </div>
                <HorizontalShelf videos={shelf.items} isLoading={false} />
              </section>
            ))
          )}

          {(musicHomeFeed.hasNextPage || musicHomeFeed.isFetchingNextPage) && (
            <div ref={observerRef} className="py-12 flex flex-col items-center justify-center gap-4">
              <Loader2 className="animate-spin text-zinc-400" size={32} />
              <p className="text-sm text-zinc-500">さらに読み込んでいます...</p>
            </div>
          )}
        </div>
      )}

      {/* Main Grid Section (Category Results) */}
      {selectedCategory && (
        <section className="space-y-6">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/20 text-blue-500">
                <Disc size={24} className="animate-spin-slow" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-white md:text-3xl tracking-tight">
                  {`${selectedCategory} の楽曲`}
                </h2>
                <p className="text-sm text-zinc-500 font-medium">
                  {`${selectedCategory} ジャンルの厳選コンテンツ`}
                </p>
              </div>
            </div>
          </div>
          
          {categoryQuery.isLoading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-10 w-10 animate-spin text-zinc-500" />
            </div>
          ) : (
            <VideoGrid 
              items={allVideos} 
              onVideoClick={(video) => {
                const index = allVideos.findIndex(v => v.id === video.id);
                QueueManager.setQueue(allVideos, index !== -1 ? index : 0);
                navigate(`/music/player?v=${video.id}`);
              }}
            />
          )}
        </section>
      )}
    </div>
  );
}

function HorizontalShelf({ videos, isLoading }: { videos: any[], isLoading: boolean }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const { scrollLeft, clientWidth } = scrollRef.current;
      const scrollTo = direction === 'left' ? scrollLeft - clientWidth * 0.8 : scrollLeft + clientWidth * 0.8;
      scrollRef.current.scrollTo({ left: scrollTo, behavior: 'smooth' });
    }
  };

  if (isLoading) {
    return (
      <div className="flex gap-4 overflow-hidden px-2">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="w-[180px] shrink-0 space-y-3">
            <div className="aspect-square rounded-2xl bg-zinc-800 animate-pulse" />
            <div className="h-4 w-3/4 rounded bg-zinc-800 animate-pulse" />
            <div className="h-3 w-1/2 rounded bg-zinc-800 animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="group relative">
      <div className="absolute -left-4 top-1/2 z-20 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100">
        <Button 
          variant="secondary" 
          size="icon" 
          className="h-12 w-12 rounded-full bg-zinc-900/80 shadow-xl backdrop-blur-sm border border-white/5"
          onClick={() => scroll('left')}
        >
          <ChevronLeft size={24} />
        </Button>
      </div>
      <div className="absolute -right-4 top-1/2 z-20 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100">
        <Button 
          variant="secondary" 
          size="icon" 
          className="h-12 w-12 rounded-full bg-zinc-900/80 shadow-xl backdrop-blur-sm border border-white/5"
          onClick={() => scroll('right')}
        >
          <ChevronRight size={24} />
        </Button>
      </div>

      <div 
        ref={scrollRef}
        className="no-scrollbar flex gap-5 overflow-x-auto px-2 scroll-smooth"
      >
        {videos.map((video) => (
          <div 
            key={video.id} 
            className="w-[180px] shrink-0 cursor-pointer group/item"
            onClick={() => {
              const index = videos.findIndex(v => v.id === video.id);
              QueueManager.setQueue(videos, index !== -1 ? index : 0);
              navigate(`/music/player?v=${video.id}`);
            }}
          >
            <div className="relative aspect-square overflow-hidden rounded-2xl shadow-lg transition-all duration-500 group-hover/item:scale-105 group-hover/item:shadow-white/10">
              <img 
                src={video.thumbnail} 
                alt={video.title}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 transition-opacity group-hover/item:opacity-100 flex items-center justify-center">
                 <div className="h-12 w-12 rounded-full bg-white text-black flex items-center justify-center shadow-2xl transform scale-75 group-hover/item:scale-100 transition-transform duration-300">
                    <Play size={24} fill="currentColor" />
                 </div>
              </div>
            </div>
            <div className="mt-3 space-y-1">
              <h3 className="line-clamp-1 text-sm font-bold text-white group-hover/item:text-blue-400 transition-colors">{video.title}</h3>
              <p className="line-clamp-1 text-xs text-zinc-500 font-medium">{video.channelTitle}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
