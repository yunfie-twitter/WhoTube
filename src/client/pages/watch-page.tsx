import { useSearchParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { WatchPlayerSection } from '../components/watch/watch-player-section';
import { CommentsPanel } from '../components/watch/comments-panel';
import { VideoDescription } from '../components/watch/video-description';
import { useAuth } from '../lib/auth';
import { ShareModal } from '../components/watch/share-modal';
import { SaveToPlaylistModal } from '../components/watch/save-to-playlist-modal';
import { VideoHeader } from '../components/watch/video-header';
import { ErrorPage } from './error-page';
import { AppSidebar } from '../components/layout/app-sidebar';
import { cn } from '../lib/utils';
import { PlaybackQueue } from '../components/watch/playback-queue';
import { offlineManager } from '../lib/offline';
import { RecommendationList } from '../components/watch/recommendation-list';
import { WatchSkeleton } from '../components/watch/watch-skeleton';
import { useWatchData, useWatchSideEffects } from '../hooks/use-watch';

function markAutoplayIntent() {
  window.sessionStorage.setItem('whotube:autoplay-with-sound', '1');
}

export function WatchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const auth = useAuth();
  
  const {
    id,
    isOfflineMode,
    detailQuery,
    manifestQuery,
    commentsQuery,
    relatedQuery,
    captionsQuery,
    offlineQuery,
    channelQuery,
    commentSort,
    setCommentSort,
    hideComments,
    showRelated,
    recommendationTab,
    setRecommendationTab,
    recommendedVideos,
    isRecommendationReady,
    videoTitle,
    author,
    channelId
  } = useWatchData();

  const subscriptionOwner = { isAuthenticated: auth.isAuthenticated && Boolean(auth.user?.id), userId: auth.user?.id };
  const autoPlay = searchParams.get('autoplay') === '1';
  const startTimeParam = searchParams.get('t') || searchParams.get('start');
  const startTime = startTimeParam ? parseInt(startTimeParam, 10) : undefined;
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<number | undefined>(undefined);
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [isTheaterMode, setIsTheaterMode] = useState(false);
  const [ratingPrompt, setRatingPrompt] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);

  const thumbnail = offlineQuery.data?.thumbnail ?? manifestQuery.data?.metadata?.thumbnails?.[0] ?? 
    (detailQuery.data?.detail?.thumbnails ? 
      [...detailQuery.data.detail.thumbnails].sort((a: any, b: any) => (b.width || 0) - (a.width || 0))[0]?.url : 
      detailQuery.data?.detail?.thumbnail);
  const authorThumbnail = detailQuery.data?.detail?.authorThumbnail;
  const authorSubscriberCount = detailQuery.data?.detail?.authorSubscriberCount;
  const channelThumbnail = channelQuery.data?.channel.thumbnail || authorThumbnail;
  const subscriberCount = channelQuery.data?.channel.subscriberCount || authorSubscriberCount;

  const description = String(
    detailQuery.data?.detail?.normalizedDescription ??
      detailQuery.data?.detail?.description?.text ??
      (typeof detailQuery.data?.detail?.description === 'string' ? detailQuery.data.detail.description : undefined) ??
      detailQuery.data?.detail?.shortDescription?.text ??
      detailQuery.data?.detail?.shortDescription ??
      detailQuery.data?.detail?.basic_info?.short_description ??
      ''
  );

  const { onPlaybackEnded, onSubscribe, isForcedChannel } = useWatchSideEffects({
    id,
    videoTitle,
    author,
    channelId,
    thumbnail,
    channelThumbnail,
    description,
    viewCount: detailQuery.data?.detail?.viewCount,
    published: detailQuery.data?.detail?.published,
    subscriptionOwner
  });

  useEffect(() => {
    const onToggleMenu = () => setIsSidebarOpen(v => !v);
    const onOpenShare = () => {
      const params = new URLSearchParams(window.location.search);
      params.set('share', '1');
      setSearchParams(params);
    };
    window.addEventListener('whotube:toggle-menu', onToggleMenu);
    window.addEventListener('whotube:open-share', onOpenShare);
    return () => {
      window.removeEventListener('whotube:toggle-menu', onToggleMenu);
      window.removeEventListener('whotube:open-share', onOpenShare);
    };
  }, [setSearchParams]);

  useEffect(() => {
    if (id) {
      offlineManager.isVideoDownloaded(id).then(setIsDownloaded);
    }
  }, [id]);

  function handleShareClick() {
    const params = new URLSearchParams(searchParams);
    params.set('share', '1');
    setSearchParams(params);
    window.dispatchEvent(new CustomEvent('whotube:open-share'));
  }

  async function handleOfflineClick() {
    if (isDownloaded) {
      if (confirm('この動画をオフライン保存から削除しますか？')) {
        await offlineManager.deleteVideo(id);
        setIsDownloaded(false);
      }
      return;
    }

    const manifest = manifestQuery.data;
    if (!manifest || !manifest.dashManifestUrl) {
      alert('この動画はオフライン保存に対応していません（マニフェストが見つかりません）。');
      return;
    }

    try {
      setDownloadProgress(0);
      await offlineManager.downloadVideo(
        id,
        manifest.dashManifestUrl,
        {
          id,
          title: videoTitle,
          author,
          thumbnail,
          durationText: detailQuery.data?.detail?.durationText || String(manifest.metadata?.lengthSeconds || '')
        },
        (progress) => setDownloadProgress(progress)
      );
      setIsDownloaded(true);
      setDownloadProgress(undefined);
    } catch (e) {
      console.error(e);
      alert('ダウンロードに失敗しました。');
      setDownloadProgress(undefined);
    }
  }

  if (detailQuery.isError) {
    return <ErrorPage type="unavailable" title="動画を読み込めません" />;
  }

  const isInitialLoading = !detailQuery.data && !manifestQuery.data && !offlineQuery.data;

  if (isInitialLoading && (detailQuery.isLoading || manifestQuery.isLoading || offlineQuery.isLoading)) {
    return <WatchSkeleton isTheaterMode={isTheaterMode} />;
  }

  return (
    <div className="flex w-full flex-col overflow-x-hidden bg-zinc-50 transition-colors duration-300 dark:bg-[#0f0f0f]">
      {/* Modals & Overlays */}
      {ratingPrompt && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-zinc-900 shadow-2xl ring-1 ring-black/10 dark:bg-[#282828] dark:text-zinc-100 dark:ring-white/10">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white">動画を評価しますか？</h3>
            <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300">続行するにはYouTubeを開いてください。</p>
            <div className="mt-6 flex justify-end gap-3">
              <button 
                type="button" 
                onClick={() => setRatingPrompt(false)} 
                className="rounded-full px-5 py-2 text-sm font-bold text-zinc-500 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-white/10"
              >
                キャンセル
              </button>
              <button 
                type="button" 
                onClick={() => setRatingPrompt(false)} 
                className="rounded-full bg-blue-600 px-5 py-2 text-sm font-bold text-white hover:bg-blue-500 transition-colors"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar Drawer */}
      <div 
        className={cn(
          "fixed inset-y-0 left-0 z-[60] w-60 transform border-r border-zinc-200 bg-white transition-transform duration-300 ease-in-out dark:border-zinc-800 dark:bg-[#0f0f0f]",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <AppSidebar showLogo onClose={() => setIsSidebarOpen(false)} className="h-full px-2" />
      </div>
      
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <ShareModal 
        isOpen={Boolean(id && searchParams.get('share') === '1')} 
        onClose={() => {
          const params = new URLSearchParams(searchParams);
          params.delete('share');
          setSearchParams(params);
          window.dispatchEvent(new CustomEvent('whotube:close-share'));
        }} 
        videoUrl={`${window.location.origin}/watch/${id}`}
        currentTime={0}
      />
      
      <SaveToPlaylistModal
        isOpen={saveModalOpen}
        onClose={() => setSaveModalOpen(false)}
        video={{
          id,
          title: videoTitle,
          channelId,
          channelTitle: author,
          channelThumbnail,
          thumbnail
        }}
      />

      {/* Main Layout */}
      <main className={cn(
        "relative mx-auto w-full transition-all duration-500",
        isTheaterMode ? "max-w-none" : "max-w-[2200px] px-0 lg:px-6 lg:pt-4"
      )}>
        <div className={cn(
          "grid gap-6",
          isTheaterMode 
            ? "grid-cols-1" 
            : "lg:grid-cols-[minmax(0,1fr)_350px] xl:grid-cols-[minmax(0,1fr)_400px]"
        )}>
          
          {/* Left Column (Player + Info) */}
          <div className="flex flex-col gap-4">
            <div className={cn(
              "relative w-full overflow-hidden transition-all duration-300",
              isTheaterMode ? "bg-black" : "rounded-none md:rounded-xl"
            )}>
              {/* Cinematic Lighting Effect */}
              {!isTheaterMode && (
                <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
                  <div className="absolute -top-[20%] left-1/2 h-[140%] w-[140%] -translate-x-1/2 rounded-[100%] bg-zinc-400/20 blur-[120px] transition-all duration-1000 dark:bg-white/5" />
                  <div className="absolute top-0 left-0 h-full w-full bg-gradient-to-b from-transparent via-zinc-50/80 to-zinc-50 dark:via-[#0f0f0f]/80 dark:to-[#0f0f0f]" />
                </div>
              )}
              
              <WatchPlayerSection
                key={id}
                videoId={id}
                manifest={isOfflineMode && offlineQuery.data ? {
                  metadata: {
                    id,
                    title: offlineQuery.data.title,
                    author: offlineQuery.data.author,
                    thumbnails: [offlineQuery.data.thumbnail]
                  },
                  defaultStream: {
                    url: offlineQuery.data.blob ? URL.createObjectURL(offlineQuery.data.blob) : (offlineQuery.data.offlineUri || ''),
                    itag: 0,
                    playbackMode: offlineQuery.data.blob ? 'direct' : 'dash'
                  },
                  muxed: [],
                  videoOnly: [],
                  audioOnly: []
                } : manifestQuery.data}
                captions={captionsQuery.data}
                title={videoTitle}
                author={author}
                channelId={channelId}
                channelThumbnail={channelThumbnail}
                subscriberCount={subscriberCount}
                poster={thumbnail}
                autoPlay={autoPlay}
                startTime={startTime}
                likeCount={detailQuery.data?.detail?.likeCount}
                endScreenVideos={recommendedVideos.slice(0, 3)}
                onSubscribe={onSubscribe}
                isTheaterMode={isTheaterMode}
                onToggleTheater={() => setIsTheaterMode(!isTheaterMode)}
                onPlaybackEnded={onPlaybackEnded}
              />
            </div>

            <div className={cn(
              "flex flex-col gap-6 px-4 md:px-0",
              isTheaterMode && showRelated && "xl:grid xl:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_400px] gap-6"
            )}>
              <div className="flex flex-col gap-6">
                <VideoHeader 
                  videoId={id}
                  title={videoTitle}
                  author={author}
                  channelId={channelId}
                  channelThumbnail={channelThumbnail}
                  subscriberCount={subscriberCount}
                  likeCount={detailQuery.data?.detail?.likeCount}
                  onSubscribe={onSubscribe}
                  onShare={handleShareClick}
                  onSave={() => setSaveModalOpen(true)}
                  onOffline={handleOfflineClick}
                  isDownloading={downloadProgress !== undefined}
                  downloadProgress={downloadProgress}
                  isDownloaded={isDownloaded}
                  onRatingPrompt={() => setRatingPrompt(true)}
                  isForcedChannel={isForcedChannel}
                />

                <VideoDescription
                  description={description}
                  viewCount={detailQuery.data?.detail?.viewCount}
                  likeCount={detailQuery.data?.detail?.likeCount}
                  published={detailQuery.data?.detail?.published}
                  category={detailQuery.data?.detail?.category}
                  tags={detailQuery.data?.detail?.tags}
                />

                {!hideComments && (
                  <CommentsPanel
                    count={commentsQuery.data?.pages[0]?.count}
                    comments={commentsQuery.data?.pages.flatMap(p => p.comments) ?? []}
                    videoId={id}
                    sort={commentSort}
                    onSortChange={setCommentSort}
                    fetchNextPage={commentsQuery.fetchNextPage}
                    hasNextPage={commentsQuery.hasNextPage}
                    isFetchingNextPage={commentsQuery.isFetchingNextPage}
                  />
                )}
              </div>

              {/* Sidebar in Theater Mode (Bottom Right) */}
              {isTheaterMode && showRelated && (
                <aside className="hidden overflow-y-auto lg:block space-y-4 no-scrollbar">
                  <PlaybackQueue />
                  <RecommendationList 
                    videoTitle={videoTitle}
                    id={id}
                    author={author}
                    recommendationTab={recommendationTab}
                    setRecommendationTab={setRecommendationTab}
                    recommendedVideos={recommendedVideos}
                    markAutoplayIntent={markAutoplayIntent}
                    isLoading={!isRecommendationReady || relatedQuery.isLoading}
                  />
                </aside>
              )}
            </div>
          </div>

          {/* Right Column (Recommendations) - Normal Mode */}
          {!isTheaterMode && showRelated && (
            <aside className="flex flex-col gap-4 overflow-y-auto px-4 md:px-0 no-scrollbar">
              <PlaybackQueue />
              <RecommendationList 
                videoTitle={videoTitle}
                id={id}
                author={author}
                recommendationTab={recommendationTab}
                setRecommendationTab={setRecommendationTab}
                recommendedVideos={recommendedVideos}
                markAutoplayIntent={markAutoplayIntent}
                isLoading={!isRecommendationReady || relatedQuery.isLoading}
              />
            </aside>
          )}

          {/* Mobile/Theater Recommendations at bottom */}
          {(!showRelated || (isTheaterMode && !showRelated)) && (
            <div 
              className="overflow-x-hidden no-scrollbar px-4 md:px-0 lg:hidden"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              <RecommendationList 
                videoTitle={videoTitle}
                id={id}
                author={author}
                recommendationTab={recommendationTab}
                setRecommendationTab={setRecommendationTab}
                recommendedVideos={recommendedVideos}
                markAutoplayIntent={markAutoplayIntent}
                isLoading={!isRecommendationReady || relatedQuery.isLoading}
              />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
