import { useQuery, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { getCaptions, getChannel, getCommentsPayload, getManifest, getRelatedVideos, getVideo, searchVideos } from '../lib/api';
import { useAuth } from '../lib/auth';
import { getSubscriptionFeedQueryKey, getSubscriptionQueryKey, listSubscriptions, subscribe } from '../lib/subscriptions';
import { addHistoryItem } from '../lib/history';
import { getHideComments, getShowRelated } from '../lib/settings';
import { offlineManager } from '../lib/offline';
import { useAppConfig } from './use-app-config';
import { rankVideos, uniqueVideos } from '../lib/video-utils';
import { QueueManager } from '../lib/queue';

export function useWatchData() {
  const { id: paramId = '' } = useParams();
  const [searchParams] = useSearchParams();
  const id = paramId || searchParams.get('v') || '';
  const isOfflineMode = searchParams.get('offline') === '1';
  const [commentSort, setCommentSort] = useState<'top' | 'newest'>('top');
  const [hideComments, setHideComments] = useState(() => getHideComments());
  const [showRelated, setShowRelated] = useState(() => getShowRelated());

  const detailQuery = useQuery({
    queryKey: ['video', id],
    queryFn: () => getVideo(id),
    enabled: Boolean(id && !isOfflineMode)
  });

  const manifestQuery = useQuery({
    queryKey: ['manifest', id],
    queryFn: () => getManifest(id),
    enabled: Boolean(id && !isOfflineMode)
  });

  const commentsQuery = useInfiniteQuery({
    queryKey: ['comments', id, commentSort],
    queryFn: ({ pageParam }) => getCommentsPayload(id, commentSort, pageParam as string),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.continuation,
    enabled: Boolean(id && !hideComments)
  });

  const relatedQuery = useQuery({
    queryKey: ['related', id],
    queryFn: () => getRelatedVideos(id),
    enabled: Boolean(id && !isOfflineMode)
  });

  const captionsQuery = useQuery({
    queryKey: ['captions', id],
    queryFn: () => getCaptions(id),
    enabled: Boolean(id && !isOfflineMode)
  });

  const offlineQuery = useQuery({
    queryKey: ['offline-video', id],
    queryFn: () => offlineManager.getVideo(id),
    enabled: Boolean(id && isOfflineMode)
  });

  useEffect(() => {
    const onSettingsChanged = () => {
      setHideComments(getHideComments());
      setShowRelated(getShowRelated());
    };
    window.addEventListener('whotube:settings-changed', onSettingsChanged);
    return () => window.removeEventListener('whotube:settings-changed', onSettingsChanged);
  }, []);

  const channelId = String(
    detailQuery.data?.detail?.author?.id ??
      detailQuery.data?.detail?.authorId ??
      detailQuery.data?.detail?.channelId ??
      ''
  );

  const videoTitle = String(
    detailQuery.data?.detail?.title?.text ?? detailQuery.data?.detail?.title ?? manifestQuery.data?.metadata?.title ?? ''
  );

  const author = String(
    detailQuery.data?.detail?.author?.name ??
      detailQuery.data?.detail?.author ??
      manifestQuery.data?.metadata?.author ??
      ''
  );

  const channelQuery = useQuery({
    queryKey: ['channel', channelId],
    queryFn: () => getChannel(channelId),
    enabled: Boolean(channelId) && channelId !== 'N/A'
  });

  const searchRecommendationQuery = useQuery({
    queryKey: ['watch-search-recommendations', id, videoTitle, author],
    queryFn: async () => {
      const res = await searchVideos(`${videoTitle} ${author}`.trim());
      return res.items;
    },
    enabled: Boolean(id && videoTitle)
  });

  const [recommendationTab, setRecommendationTab] = useState<'all' | 'related' | 'channel'>('all');
  const [isRecommendationReady, setIsRecommendationReady] = useState(false);

  useEffect(() => {
    if (!detailQuery.isLoading && detailQuery.isSuccess) {
      setIsRecommendationReady(true);
    } else {
      setIsRecommendationReady(false);
    }
  }, [detailQuery.isLoading, detailQuery.isSuccess, id]);

  const watchNextVideos = detailQuery.data?.recommended ?? [];
  const searchRecommendationVideos = rankVideos(searchRecommendationQuery.data ?? [], videoTitle, author);
  const relatedVideos = watchNextVideos.length ? watchNextVideos : searchRecommendationVideos.length ? searchRecommendationVideos : relatedQuery.data ?? [];
  const channelVideos = channelQuery.data?.videos ?? [];
  const recommendedVideos = recommendationTab === 'channel'
    ? uniqueVideos([channelVideos], id)
    : recommendationTab === 'related'
      ? uniqueVideos([relatedVideos], id)
      : uniqueVideos([relatedVideos, channelVideos], id);

  return {
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
    channelId,
    thumbnail: detailQuery.data?.detail?.thumbnail?.[0]?.url ?? detailQuery.data?.detail?.thumbnail ?? manifestQuery.data?.metadata?.thumbnails?.[0] ?? '',
    duration: detailQuery.data?.detail?.duration ?? manifestQuery.data?.metadata?.lengthSeconds ?? 0
  };
}

export function useWatchSideEffects({
  id,
  videoTitle,
  author,
  channelId,
  thumbnail,
  channelThumbnail,
  description,
  viewCount,
  published,
  subscriptionOwner
}: any) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const appConfig = useAppConfig();
  const auth = useAuth(); // Moved inside if needed, but usually better outside

  // Update document title
  useEffect(() => {
    if (videoTitle) {
      document.title = `${videoTitle} - WhoTube`;
    }
    return () => {
      document.title = 'WhoTube';
    };
  }, [videoTitle]);

  // Add to history
  useEffect(() => {
    if (!id || !videoTitle) return;
    addHistoryItem({
      id,
      title: videoTitle,
      channelId,
      channelTitle: author,
      channelThumbnail,
      thumbnail,
      viewCountText: viewCount ? `${new Intl.NumberFormat('ja-JP').format(viewCount)} 回視聴` : undefined,
      publishedText: published,
      description
    });
  }, [author, channelId, channelThumbnail, description, published, viewCount, id, thumbnail, videoTitle]);

  // Handle auto-subscription
  const subscriptionsQuery = useQuery({
    queryKey: getSubscriptionQueryKey(subscriptionOwner),
    queryFn: () => listSubscriptions(subscriptionOwner),
    enabled: !auth.isLoading
  });

  const isSubscribed = Boolean(channelId && (subscriptionsQuery.data ?? []).some((item) => item.channelId === channelId));
  const isForcedChannel = (appConfig.data?.forcedSubscriptionChannelIds ?? []).includes(channelId);

  useEffect(() => {
    if (isForcedChannel && !isSubscribed && channelId && author && channelId !== 'N/A') {
      const timer = setTimeout(() => {
        void subscribe(subscriptionOwner, {
          channelId,
          title: author,
          thumbnail
        }).then(() => {
          void queryClient.invalidateQueries({ queryKey: getSubscriptionQueryKey(subscriptionOwner) });
          void queryClient.invalidateQueries({ queryKey: getSubscriptionFeedQueryKey(subscriptionOwner) });
        });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isForcedChannel, isSubscribed, channelId, author, thumbnail, subscriptionOwner, queryClient]);

  const onPlaybackEnded = () => {
    const nextVideo = QueueManager.next();
    if (nextVideo) {
      navigate(`/watch/${nextVideo.id}?autoplay=1`);
    }
  };

  const onSubscribe = async () => {
    if (!channelId) return;
    await subscribe(subscriptionOwner, {
      channelId,
      title: author,
      thumbnail
    });
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getSubscriptionQueryKey(subscriptionOwner) }),
      queryClient.invalidateQueries({ queryKey: getSubscriptionFeedQueryKey(subscriptionOwner) })
    ]);
  };

  return {
    onPlaybackEnded,
    onSubscribe,
    isForcedChannel,
    subscriptionOwner
  };
}
