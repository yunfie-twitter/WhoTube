import { useState, useRef, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { useParams, useLocation, Link } from 'react-router-dom';
import { getChannel, getChannelVideos, getChannelShorts, getChannelLive, searchVideos } from '../lib/api';
import { VideoGrid } from '../components/video/video-grid';
import { CheckCircle2, Search, Bell, ChevronDown, Plus, X, Music2, ChevronRight, ChevronLeft, Play, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { Button } from '../components/ui/button';
import { useSubscriptionNotifications } from '../hooks/use-subscription-notifications';
import { useAppConfig } from '../hooks/use-app-config';
import { useAuth } from '../lib/auth';
import { proxyImageUrl } from '../lib/images';
import { ErrorPage } from './error-page';
import {
  getSubscriptionFeedQueryKey,
  getSubscriptionQueryKey,
  listSubscriptions,
  subscribe,
  unsubscribe
} from '../lib/subscriptions';
import { VideoItem } from '../lib/types';
import { Terminal } from 'lucide-react';

const DEVELOPER_CHANNEL_ID = 'UCfjIuWCkkuDGRs1NL4smgyg';
const tabs = ['ホーム', '動画', 'ショート', 'ライブ', 'リリース', '再生リスト', '投稿', 'ストア'];

function VideoCard({ video }: { video: VideoItem }) {
  const path = video.isShort ? `/shorts/${video.id}` : `/watch/${video.id}`;
  
  return (
    <Link to={path} className="group block">
      <div className="relative aspect-video overflow-hidden rounded-xl bg-zinc-200 dark:bg-zinc-800">
        <img 
          src={video.thumbnail} 
          alt={video.title} 
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" 
        />
        <div className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-xs font-bold text-white">
          {video.durationText}
        </div>
      </div>
      <div className="mt-3 pr-2">
        <h3 className="line-clamp-2 text-sm font-bold leading-snug text-zinc-900 dark:text-white group-hover:text-blue-600 transition-colors">
          {video.title}
        </h3>
        <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          <p>{video.viewCountText}</p>
          <p>{video.publishedText}</p>
          {video.badges && video.badges.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {video.badges.map((badge) => (
                <span key={badge} className="rounded-[2px] bg-zinc-100 px-1 text-[10px] font-bold text-zinc-500 dark:bg-white/10 dark:text-zinc-400">
                  {badge}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

function HorizontalShelf({ section }: { section: any }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const scrollAmount = direction === 'left' ? -800 : 800;
    scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
  };

  return (
    <section className="group relative">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white">{section.title}</h2>
          {section.title === '動画' && (
            <button className="flex items-center gap-1 text-sm font-bold text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white">
              <Play size={14} fill="currentColor" />
              すべて再生
            </button>
          )}
        </div>
        <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button onClick={() => scroll('left')} className="rounded-full p-2 hover:bg-zinc-100 dark:hover:bg-white/10">
            <ChevronLeft size={24} />
          </button>
          <button onClick={() => scroll('right')} className="rounded-full p-2 hover:bg-zinc-100 dark:hover:bg-white/10">
            <ChevronRight size={24} />
          </button>
        </div>
      </div>
      
      <div 
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto no-scrollbar snap-x snap-mandatory"
      >
        {section.items.map((video: any) => (
          <div key={video.id} className="w-[280px] shrink-0 snap-start">
            <VideoCard video={video} />
          </div>
        ))}
      </div>
    </section>
  );
}

export function ChannelPage() {
  const { id: paramId = '' } = useParams();
  const location = useLocation();
  const id = location.pathname.startsWith('/@') ? `@${paramId}` : paramId;
  const queryClient = useQueryClient();
  const auth = useAuth();
  const notifications = useSubscriptionNotifications();
  const owner = { isAuthenticated: auth.isAuthenticated && Boolean(auth.user?.id), userId: auth.user?.id };
  const [activeTab, setActiveTab] = useState('ホーム');
  const [videoSort, setVideoSort] = useState<'latest' | 'popular' | 'oldest'>('latest');
  const [aboutOpen, setAboutOpen] = useState(false);
  const appConfig = useAppConfig();

  const loadMoreRef = useRef<HTMLDivElement>(null);

  const query = useQuery({
    queryKey: ['channel', id],
    queryFn: () => getChannel(id),
    enabled: Boolean(id) && id !== 'N/A'
  });

  const channel = query.data?.channel;
  const initialVideos = query.data?.videos ?? [];
  const sections = query.data?.sections ?? [];

  const videosQuery = useInfiniteQuery({
    queryKey: ['channel-videos', id],
    queryFn: ({ pageParam }) => getChannelVideos(id, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.continuation,
    enabled: activeTab === '動画' && Boolean(id) && id !== 'N/A'
  });

  const shortsQuery = useInfiniteQuery({
    queryKey: ['channel-shorts', id],
    queryFn: ({ pageParam }) => getChannelShorts(id, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.continuation,
    enabled: activeTab === 'ショート' && Boolean(id) && id !== 'N/A'
  });

  const liveQuery = useInfiniteQuery({
    queryKey: ['channel-live', id],
    queryFn: ({ pageParam }) => getChannelLive(id, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.continuation,
    enabled: activeTab === 'ライブ' && Boolean(id) && id !== 'N/A'
  });

  const allVideos = useMemo(() => {
    const paged = videosQuery.data?.pages.flatMap(p => p.items) ?? [];
    if (paged.length > 0) return paged;
    return initialVideos;
  }, [videosQuery.data, initialVideos]);

  const allShorts = useMemo(() => {
    return shortsQuery.data?.pages.flatMap(p => p.items) ?? [];
  }, [shortsQuery.data]);

  const allLive = useMemo(() => {
    return liveQuery.data?.pages.flatMap(p => p.items) ?? [];
  }, [liveQuery.data]);

  const isFetchingNextPage = videosQuery.isFetchingNextPage || shortsQuery.isFetchingNextPage || liveQuery.isFetchingNextPage;

  useEffect(() => {
    if (isFetchingNextPage) return;
    
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        if (activeTab === '動画' && videosQuery.hasNextPage) videosQuery.fetchNextPage();
        if (activeTab === 'ショート' && shortsQuery.hasNextPage) shortsQuery.fetchNextPage();
        if (activeTab === 'ライブ' && liveQuery.hasNextPage) liveQuery.fetchNextPage();
      }
    }, { threshold: 0.1 });

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [activeTab, videosQuery, shortsQuery, liveQuery, isFetchingNextPage]);

  const subscriptionsQuery = useQuery({
    queryKey: getSubscriptionQueryKey(owner),
    queryFn: () => listSubscriptions(owner),
    enabled: !auth.isLoading
  });

  const isSubscribed = Boolean(id && (subscriptionsQuery.data ?? []).some((item) => item.channelId === id));
  const isForcedChannel = (appConfig.data?.forcedSubscriptionChannelIds ?? []).includes(id);

  useEffect(() => {
    if (isForcedChannel && !isSubscribed && channel && id) {
      const timer = setTimeout(() => {
        void subscribe(owner, {
          channelId: id,
          title: channel.title,
          thumbnail: channel.thumbnail
        }).then(() => {
          void queryClient.invalidateQueries({ queryKey: getSubscriptionQueryKey(owner) });
          void queryClient.invalidateQueries({ queryKey: getSubscriptionFeedQueryKey(owner) });
        });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isForcedChannel, isSubscribed, channel, id, owner, queryClient]);

  if (query.isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-zinc-300 border-t-red-600" />
          <p className="text-sm font-medium text-zinc-500 animate-pulse">チャンネルを読み込み中...</p>
        </div>
      </div>
    );
  }

  if (query.isError) {
    return <ErrorPage type="unavailable" title="チャンネルを読み込めません" />;
  }
  
  const sortedVideos = [...allVideos].sort((a, b) => {
    if (videoSort === 'oldest') return 1;
    if (videoSort === 'popular') {
      const count = (text?: string) => Number(String(text || '').replace(/[^\d]/g, '')) || 0;
      return count(b.viewCountText) - count(a.viewCountText);
    }
    return 0;
  });

  async function onSubscriptionClick() {
    if (!id || !channel) return;

    if (isSubscribed) {
      await unsubscribe(owner, id);
    } else {
      await subscribe(owner, {
        channelId: id,
        title: channel.title,
        thumbnail: channel.thumbnail
      });
    }

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getSubscriptionQueryKey(owner) }),
      queryClient.invalidateQueries({ queryKey: getSubscriptionFeedQueryKey(owner) })
    ]);
  }


  return (
    <div className="flex flex-col bg-white text-zinc-900 transition-colors duration-300 dark:bg-[#0f0f0f] dark:text-zinc-100">
      {isForcedChannel && (
        <div className="bg-red-900 px-4 py-3.5 text-center text-sm font-black text-white shadow-xl">
          <div className="mx-auto flex max-w-[1284px] items-center justify-center gap-3 tracking-wide">
            <Bell size={18} className="shrink-0 animate-pulse" />
            <span className="uppercase">このチャンネルはインスタンス運営者によって固定されています</span>
          </div>
        </div>
      )}
      {/* Banner */}
      {channel?.banner && (
        <div className="relative w-full overflow-hidden bg-zinc-200 dark:bg-zinc-800 aspect-[16/3] md:aspect-[6/1]">
          <img src={proxyImageUrl(channel.banner)} alt="" className="h-full w-full object-cover" />
        </div>
      )}

      <div className="mx-auto w-full max-w-[1284px] px-4 md:px-6">
        {/* Channel Header */}
        <div className="flex flex-col gap-5 py-6 md:flex-row md:items-start md:py-8 lg:gap-8">
          <div className="flex shrink-0 justify-center md:justify-start">
            <div className="relative h-24 w-24 overflow-hidden rounded-full border border-black/5 bg-zinc-100 dark:border-white/5 dark:bg-zinc-800 md:h-40 md:w-40">
              {channel?.thumbnail ? (
                <img src={proxyImageUrl(channel.thumbnail)} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-4xl font-bold bg-zinc-200 dark:bg-zinc-800">
                  {channel?.title?.charAt(0)}
                </div>
              )}
            </div>
          </div>
          
          <div className="flex flex-1 flex-col text-center md:text-left">
            <div className="flex flex-wrap items-center justify-center gap-2 md:justify-start">
              <h1 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white md:text-4xl">{channel?.title}</h1>
              {id === DEVELOPER_CHANNEL_ID && (
                <div className="flex items-center gap-1 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white shadow-lg ring-1 ring-white/20">
                  <Terminal size={12} className="mr-1" />
                  開発者
                </div>
              )}
              {channel?.isVerifiedArtist ? (
                <Music2 size={20} className="text-zinc-500 dark:text-zinc-400" />
              ) : channel?.isVerified ? (
                <CheckCircle2 size={18} className="fill-zinc-500 text-white dark:fill-zinc-400 dark:text-[#0f0f0f]" />
              ) : null}
            </div>
            
            <div className="mt-2 flex flex-wrap items-center justify-center gap-x-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 md:justify-start">
              {channel?.handle ? <span>{channel.handle}</span> : null}
              {channel?.subscriberCount && (
                <>
                  <span className="text-zinc-300 dark:text-zinc-700">•</span>
                  <span>{channel.subscriberCount}</span>
                </>
              )}
              {channel?.videoCount && (
                <>
                  <span className="text-zinc-300 dark:text-zinc-700">•</span>
                  <span>{channel.videoCount}</span>
                </>
              )}
            </div>

            <button 
              type="button" 
              onClick={() => setAboutOpen(true)}
              className="group mt-3 flex flex-col items-center text-left md:items-start"
            >
              <p className="line-clamp-1 max-w-2xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                {channel?.description || 'このチャンネルの説明はありません。'}
              </p>
              <div className="mt-1 flex items-center gap-1 text-sm font-bold text-zinc-900 dark:text-white">
                さらに表示
                <ChevronRight size={16} className="transition-transform group-hover:translate-x-0.5" />
              </div>
            </button>

            {channel?.links?.length ? (
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2 md:justify-start">
                <a 
                  href={channel.links[0].url} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1 text-xs font-bold text-blue-600 hover:bg-zinc-200 dark:bg-white/5 dark:text-sky-400 dark:hover:bg-white/10"
                >
                  <span className="truncate max-w-[150px]">{channel.links[0].title}</span>
                  {channel.links.length > 1 && (
                    <span className="text-zinc-400 dark:text-zinc-500 ml-1">
                      他 {channel.links.length - 1} 件のリンク
                    </span>
                  )}
                </a>
              </div>
            ) : null}

            {!isForcedChannel && (
              <div className="mt-6 flex justify-center md:justify-start">
                <Button
                  onClick={onSubscriptionClick}
                  disabled={subscriptionsQuery.isLoading}
                  className={cn(
                    'h-9 rounded-full px-5 font-bold transition-all active:scale-95',
                    isSubscribed
                      ? 'bg-zinc-100 text-zinc-900 hover:bg-zinc-200 dark:bg-white/10 dark:text-white dark:hover:bg-white/20'
                      : 'bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200'
                  )}
                >
                  {isSubscribed ? <Bell size={18} className="mr-2" /> : null}
                  {isSubscribed ? '登録済み' : 'チャンネル登録'}
                  {isSubscribed && <ChevronDown size={16} className="ml-2" />}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="sticky top-0 z-10 -mx-4 flex items-center bg-white/95 px-4 backdrop-blur-md dark:bg-[#0f0f0f]/95 md:mx-0 md:px-0">
          <div className="flex flex-1 gap-4 overflow-x-auto no-scrollbar py-1">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'relative shrink-0 px-3 py-3 text-sm font-bold transition-colors',
                  activeTab === tab 
                    ? 'text-zinc-900 dark:text-white after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:bg-zinc-900 dark:after:bg-white' 
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                )}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="ml-2 hidden h-8 w-px bg-zinc-200 dark:bg-zinc-800 md:block" />
          <button className="ml-2 p-2 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white">
            <Search size={20} />
          </button>
        </div>

        {/* Tab Content */}
        <div className="py-8">
          {activeTab === 'ホーム' && (
            <div className="space-y-12">
              {sections.length > 0 ? (
                sections.map((section, idx) => (
                  <HorizontalShelf key={`${section.title}-${idx}`} section={section} />
                ))
              ) : (initialVideos.length > 0 || (query.data?.live && query.data.live.length > 0) || (query.data?.shorts && query.data.shorts.length > 0)) ? (
                <>
                  {initialVideos.length > 0 && (
                    <section>
                      <h2 className="mb-4 text-xl font-bold">おすすめ</h2>
                      <VideoGrid items={initialVideos.slice(0, 12)} hideChannel />
                    </section>
                  )}
                  {query.data?.shorts && query.data.shorts.length > 0 && (
                    <section>
                      <h2 className="mb-4 text-xl font-bold">ショート</h2>
                      <VideoGrid items={query.data.shorts.slice(0, 6)} hideChannel />
                    </section>
                  )}
                </>
              ) : (
                <div className="flex h-60 flex-col items-center justify-center gap-4 text-zinc-500">
                  <div className="h-20 w-20 rounded-full bg-zinc-100 flex items-center justify-center dark:bg-zinc-800">
                    <Play size={32} className="text-zinc-400" />
                  </div>
                  <p className="font-medium">このチャンネルにはまだコンテンツがありません。</p>
                </div>
              )}
            </div>
          )}

          {activeTab === '動画' && (
            <div className="space-y-6">
              <div className="flex gap-2">
                {[
                  { id: 'latest', label: '最新' },
                  { id: 'popular', label: '人気' },
                  { id: 'oldest', label: '古い順' }
                ].map((sort) => (
                  <button
                    key={sort.id}
                    onClick={() => setVideoSort(sort.id as any)}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-sm font-bold transition-colors",
                      videoSort === sort.id 
                        ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-950" 
                        : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-white/10 dark:text-zinc-300 dark:hover:bg-white/20"
                    )}
                  >
                    {sort.label}
                  </button>
                ))}
              </div>
              <VideoGrid items={sortedVideos} hideChannel />
            </div>
          )}

          {activeTab === 'ショート' && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {allShorts.map(video => (
                 <div key={video.id} className="group cursor-pointer">
                    <Link to={`/shorts/${video.id}`}>
                      <div className="relative aspect-[9/16] overflow-hidden rounded-xl bg-zinc-200 dark:bg-zinc-800">
                        <img src={video.thumbnail} alt={video.title} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                      </div>
                      <div className="mt-3">
                        <h3 className="line-clamp-2 text-sm font-bold leading-snug">{video.title}</h3>
                        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{video.viewCountText}</p>
                      </div>
                    </Link>
                 </div>
              ))}
              {shortsQuery.isLoading && (
                Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="aspect-[9/16] animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-800" />
                ))
              )}
            </div>
          )}

          {activeTab === 'ライブ' && (
            <VideoGrid items={allLive} hideChannel />
          )}

          {/* Load More Indicator */}
          <div ref={loadMoreRef} className="flex justify-center py-8">
            {isFetchingNextPage && (
              <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
            )}
          </div>

          {['リリース', '再生リスト', '投稿', 'ストア'].includes(activeTab) && (
            <div className="flex h-60 items-center justify-center text-zinc-500">
              <p>{activeTab}のコンテンツは現在準備中です。</p>
            </div>
          )}
        </div>
      </div>

      {aboutOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setAboutOpen(false)}>
          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-[#282828]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-zinc-100 p-4 dark:border-zinc-800">
              <h2 className="text-xl font-bold">概要</h2>
              <button onClick={() => setAboutOpen(false)} className="rounded-full p-2 hover:bg-zinc-100 dark:hover:bg-white/10">
                <X size={20} />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto p-6">
              <div className="space-y-8">
                <section>
                  <h3 className="text-sm font-bold text-zinc-500 dark:text-zinc-400">説明</h3>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{channel?.description || '説明はありません。'}</p>
                </section>
                
                {channel?.links?.length ? (
                  <section>
                    <h3 className="text-sm font-bold text-zinc-500 dark:text-zinc-400">リンク</h3>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      {channel.links.map(link => (
                        <a key={link.url} href={link.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-lg border border-zinc-100 p-3 text-sm font-semibold text-blue-600 hover:bg-zinc-50 dark:border-zinc-800 dark:text-sky-400 dark:hover:bg-white/5">
                          <span className="truncate">{link.title}</span>
                        </a>
                      ))}
                    </div>
                  </section>
                ) : null}

                <section>
                  <h3 className="text-sm font-bold text-zinc-500 dark:text-zinc-400">詳細</h3>
                  <div className="mt-3 grid gap-4 text-sm sm:grid-cols-2">
                    <div className="flex flex-col">
                      <span className="text-zinc-500">登録日</span>
                      <span className="font-bold">{channel?.joinedDate || '不明'}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-zinc-500">視聴回数</span>
                      <span className="font-bold">{channel?.viewCount || '0'}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-zinc-500">地域</span>
                      <span className="font-bold">{channel?.country || '不明'}</span>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

