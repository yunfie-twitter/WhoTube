import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { VideoGrid } from '../components/video/video-grid';
import { ChannelAvatar } from '../components/video/channel-avatar';
import { useAuth } from '../lib/auth';
import { useAppConfig } from '../hooks/use-app-config';
import {
  getSubscriptionFeedQueryKey,
  getSubscriptionQueryKey,
  getSubscriptionsFeed,
  listSubscriptions,
  unsubscribe
} from '../lib/subscriptions';
import { Pin as PinIcon } from 'lucide-react';

export function SubscriptionsPage() {
  const queryClient = useQueryClient();
  const auth = useAuth();
  const owner = { isAuthenticated: auth.isAuthenticated && Boolean(auth.user?.id), userId: auth.user?.id };
  const appConfig = useAppConfig();
  const subscriptionsQuery = useQuery({
    queryKey: getSubscriptionQueryKey(owner),
    queryFn: () => listSubscriptions(owner),
    enabled: !auth.isLoading
  });
  const feedQuery = useQuery({
    queryKey: getSubscriptionFeedQueryKey(owner),
    queryFn: () => getSubscriptionsFeed(owner, 30),
    enabled: !auth.isLoading
  });

  async function onUnsubscribe(channelId: string) {
    await unsubscribe(owner, channelId);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getSubscriptionQueryKey(owner) }),
      queryClient.invalidateQueries({ queryKey: getSubscriptionFeedQueryKey(owner) })
    ]);
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white">登録チャンネル</h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {auth.isAuthenticated ? 'サインイン中のアカウントとしてサーバーに保存されています。' : 'サインインしていないため、このブラウザにローカル保存されています。'}
          </p>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          {(subscriptionsQuery.data ?? []).map((sub) => (
            <div
              key={sub.channelId}
              className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-[#181818] transition-colors duration-300"
            >
              <Link to={`/channel/${sub.channelId}`} className="flex min-w-0 items-center gap-3 text-sm font-medium text-zinc-900 dark:text-zinc-100 hover:text-blue-600 dark:hover:text-white transition-colors">
                <ChannelAvatar channelId={sub.channelId} src={sub.thumbnail} title={sub.title} />
                <span className="truncate">{sub.title ?? sub.channelId}</span>
                {(appConfig.data?.forcedSubscriptionChannelIds ?? []).includes(String(sub.channelId)) && (
                  <PinIcon size={14} className="shrink-0 text-zinc-400" />
                )}
              </Link>
              {!(appConfig.data?.forcedSubscriptionChannelIds ?? []).includes(String(sub.channelId)) && (
                <Button size="sm" variant="outline" onClick={() => onUnsubscribe(String(sub.channelId))} className="rounded-full border-zinc-200 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-white/10">
                  解除
                </Button>
              )}
            </div>
          ))}
        </div>
      </section>
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-white">登録フィード</h2>
        {feedQuery.isLoading ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading feed...</p>
        ) : (
          <VideoGrid items={feedQuery.data ?? []} />
        )}
      </section>
    </div>
  );
}
