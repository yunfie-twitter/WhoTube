import { useEffect, useState, lazy, Suspense } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { cn } from './lib/utils';

// Pages - Lazy loaded
const HomePage = lazy(() => import('./pages/home-page').then(m => ({ default: m.HomePage })));
const SearchPage = lazy(() => import('./pages/search-page').then(m => ({ default: m.SearchPage })));
const WatchPage = lazy(() => import('./pages/watch-page').then(m => ({ default: m.WatchPage })));
const ChannelPage = lazy(() => import('./pages/channel-page').then(m => ({ default: m.ChannelPage })));
const ShortsPage = lazy(() => import('./pages/shorts-page').then(m => ({ default: m.ShortsPage })));
const PlaylistPage = lazy(() => import('./pages/playlist-page').then(m => ({ default: m.PlaylistPage })));
const SubscriptionsPage = lazy(() => import('./pages/subscriptions-page').then(m => ({ default: m.SubscriptionsPage })));
const IframePlayerPage = lazy(() => import('./pages/iframe-player-page').then(m => ({ default: m.IframePlayerPage })));
const CallbackPage = lazy(() => import('./pages/callback-page').then(m => ({ default: m.CallbackPage })));
const HistoryPage = lazy(() => import('./pages/history-page').then(m => ({ default: m.HistoryPage })));
const MyPage = lazy(() => import('./pages/mypage-page').then(m => ({ default: m.MyPage })));
const SettingsPage = lazy(() => import('./pages/settings-page').then(m => ({ default: m.SettingsPage })));
const ErrorPage = lazy(() => import('./pages/error-page').then(m => ({ default: m.ErrorPage })));
const ErrorRoutePage = lazy(() => import('./pages/error-page').then(m => ({ default: m.ErrorRoutePage })));
const MusicPage = lazy(() => import('./pages/music-page').then(m => ({ default: m.MusicPage })));
const MusicSearchPage = lazy(() => import('./pages/music-search-page').then(m => ({ default: m.MusicSearchPage })));
const MusicPlayerPage = lazy(() => import('./pages/music-player-page').then(m => ({ default: m.MusicPlayerPage })));
const DownloadsPage = lazy(() => import('./pages/downloads-page').then(m => ({ default: m.DownloadsPage })));
const AdminWebUIPage = lazy(() => import('./pages/admin-webui-page').then(m => ({ default: m.AdminWebUIPage })));
const IndieAuthPage = lazy(() => import('./pages/indieauth-page').then(m => ({ default: m.IndieAuthPage })));
const HashtagPage = lazy(() => import('./pages/hashtag-page').then(m => ({ default: m.HashtagPage })));

import { AppSidebar } from './components/layout/app-sidebar';
import { AppHeader } from './components/layout/app-header';
import { ProgressBar } from './components/layout/progress-bar';
import { applyTheme, getTheme } from './lib/settings';
import { useAppConfig } from './hooks/use-app-config';
import { useAuth } from './lib/auth';
import { getSubscriptionQueryKey, listSubscriptions, subscribe } from './lib/subscriptions';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { MiniMusicPlayer } from './components/music/mini-player';

export function App() {
  const location = useLocation();
  const isEmbedRoute = location.pathname.startsWith('/embed/');
  const isWatchRoute = location.pathname.startsWith('/watch/') || location.pathname.startsWith('/shorts/');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [theme, setTheme] = useState(() => getTheme());
  const appConfig = useAppConfig();
  const auth = useAuth();
  const queryClient = useQueryClient();
  const owner = { isAuthenticated: auth.isAuthenticated && Boolean(auth.user?.id), userId: auth.user?.id };

  const subscriptionsQuery = useQuery({
    queryKey: getSubscriptionQueryKey(owner),
    queryFn: () => listSubscriptions(owner),
    enabled: !auth.isLoading && !!appConfig.data
  });

  useEffect(() => {
    applyTheme(getTheme());
    const onSettingsChanged = () => setTheme(getTheme());
    window.addEventListener('whotube:settings-changed', onSettingsChanged);
    
    // Protocol Handler & URL Launch Handling
    const params = new URLSearchParams(window.location.search);
    const urlParam = params.get('url');
    if (urlParam && urlParam.includes('v=')) {
      const videoIdMatch = urlParam.match(/[?&]v=([^&]+)/) || urlParam.match(/v=([^&]+)/);
      if (videoIdMatch) {
        window.location.href = `/watch/${videoIdMatch[1]}`;
      }
    }

    return () => window.removeEventListener('whotube:settings-changed', onSettingsChanged);
  }, []);

  // Global Forced Subscription Sync
  useEffect(() => {
    const forcedIds = appConfig.data?.forcedSubscriptionChannelIds || [];
    if (forcedIds.length === 0 || auth.isLoading || !subscriptionsQuery.data) return;

    const currentIds = new Set(subscriptionsQuery.data.map(s => s.channelId));
    const missingIds = forcedIds.filter(id => !currentIds.has(id));

    if (missingIds.length > 0) {
      const timer = setTimeout(async () => {
        const { getChannel } = await import('./lib/api');
        for (const id of missingIds) {
          try {
            const data = await getChannel(id);
            if (data?.channel) {
              await subscribe(owner, { 
                channelId: id, 
                title: data.channel.title,
                thumbnail: data.channel.thumbnail 
              });
            }
          } catch (error) {
            console.warn(`[AutoSubscribe] Failed to fetch metadata for ${id}:`, error);
            // Fallback to basic info if fetch fails
            await subscribe(owner, { 
              channelId: id, 
              title: `Channel ${id.slice(0, 4)}...`,
              thumbnail: '' 
            });
          }
        }
        void queryClient.invalidateQueries({ queryKey: getSubscriptionQueryKey(owner) });
        void queryClient.invalidateQueries({ queryKey: getSubscriptionFeedQueryKey(owner) });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [appConfig.data, subscriptionsQuery.data, auth.isLoading, owner, queryClient]);

  useEffect(() => {
    const isSystemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const actualTheme = theme === 'system' ? (isSystemDark ? 'dark' : 'light') : theme;
    
    if (actualTheme === 'dark') {
      document.body.style.background = '#0f0f0f';
    } else {
      document.body.style.background = '#f9fafb';
    }
  }, [theme]);

  if (isEmbedRoute) {
    return (
      <div className="min-h-screen bg-black">
        <Suspense fallback={<div className="h-screen w-screen bg-black" />}>
          <Routes>
            <Route path="/embed/:id" element={<IframePlayerPage />} />
          </Routes>
        </Suspense>
      </div>
    );
  }

  const isSystemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const actualTheme = theme === 'system' ? (isSystemDark ? 'dark' : 'light') : theme;

  return (
    <div className={cn(
      'min-h-screen transition-colors duration-300',
      actualTheme === 'light' ? 'bg-zinc-50 text-zinc-900' : 'bg-[#0f0f0f] text-zinc-100'
    )}>
      <ProgressBar />
      <AppHeader
        dark={actualTheme === 'dark'}
        compact={isWatchRoute}
        onMenuClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />

      <div className={cn(
        'pb-8 pt-2',
        isWatchRoute ? 'px-0 lg:px-4' : 'px-4',
        !isWatchRoute && 'lg:grid lg:gap-6',
        !isWatchRoute && (isSidebarCollapsed ? 'lg:grid-cols-[72px_minmax(0,1fr)]' : 'lg:grid-cols-[240px_minmax(0,1fr)]')
      )}>
        {!isWatchRoute && (
          <AppSidebar
            mini={isSidebarCollapsed}
            className="no-scrollbar sticky top-14 hidden h-[calc(100vh-56px)] overflow-y-auto pb-4 lg:block"
          />
        )}

        <main className="min-w-0">
          <Suspense fallback={<div className="flex h-[50vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-300 border-t-zinc-900 dark:border-zinc-800 dark:border-t-white" /></div>}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/watch/:id" element={<WatchPage />} />
              <Route path="/shorts/:id" element={<ShortsPage />} />
              <Route path="/watch" element={<WatchPage />} />
              <Route path="/playlist/:id" element={<PlaylistPage />} />
              <Route path="/playlist" element={<PlaylistPage />} />
              <Route path="/subscriptions" element={<SubscriptionsPage />} />
              <Route path="/callback" element={<CallbackPage />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/mypage" element={<MyPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/error/:type" element={<ErrorRoutePage />} />
              <Route path="/404" element={<ErrorPage type="not-found" />} />
              <Route path="/500" element={<ErrorPage type="server" />} />
              <Route path="/offline" element={<DownloadsPage />} />
              <Route path="/error-offline" element={<ErrorPage type="offline" />} />
              <Route path="/network-error" element={<ErrorPage type="network" />} />
              <Route path="/playback-error" element={<ErrorPage type="playback" />} />
              <Route path="/unavailable" element={<ErrorPage type="unavailable" />} />
              <Route path="/forbidden" element={<ErrorPage type="forbidden" />} />
              <Route path="/timeout" element={<ErrorPage type="timeout" />} />
              <Route path="/channel/:id" element={<ChannelPage />} />
              <Route path="/@:id" element={<ChannelPage />} />
              <Route path="/music" element={<MusicPage />} />
              <Route path="/music/search" element={<MusicSearchPage />} />
              <Route path="/music/player" element={<MusicPlayerPage />} />
              <Route path="/admin/webui" element={<AdminWebUIPage />} />
              <Route path="/auth/indieauth" element={<IndieAuthPage />} />
              <Route path="/hashtag/:tag" element={<HashtagPage />} />
              <Route path="/:id" element={<ChannelPage />} />
              <Route path="*" element={<ErrorPage type="not-found" />} />
            </Routes>
          </Suspense>
        </main>
      </div>
      <MiniMusicPlayer />
    </div>
  );
}
