import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Subscription } from '../../lib/types';
import { cn } from '../../lib/utils';
import { useAuth } from '../../lib/auth';
import { useAppConfig } from '../../hooks/use-app-config';
import { getSubscriptionQueryKey, listSubscriptions } from '../../lib/subscriptions';
import {
  ChevronDown,
  ChevronRight,
  Clock,
  History,
  Home,
  ListVideo,
  Music,
  Pin,
  PlaySquare,
  SquarePlay,
  Settings,
  UserCircle,
  Radio,
  Download
} from 'lucide-react';
import { ChannelAvatar } from '../video/channel-avatar';

interface SidebarProps {
  className?: string;
  showLogo?: boolean;
  onClose?: () => void;
  mini?: boolean;
}

export function MenuItem({
  icon: Icon,
  label,
  trailing,
  mini,
  to,
  onClick
}: {
  icon: any;
  label: string;
  trailing?: boolean;
  mini?: boolean;
  to?: string;
  onClick?: () => void;
}) {
  const content = mini ? (
    <div className="flex w-full flex-col items-center gap-1.5 rounded-lg py-4 transition-colors text-zinc-700 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-[#272727]">
      <Icon size={24} />
      <span className="text-[10px] font-medium leading-none truncate w-full text-center px-0.5">{label}</span>
    </div>
  ) : (
    <div className="flex h-10 w-full items-center gap-5 rounded-lg px-3 text-left text-sm font-semibold transition-colors text-zinc-700 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-[#272727]">
      <Icon size={21} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {trailing ? <ChevronRight size={16} /> : null}
    </div>
  );

  if (to) {
    return (
      <Link to={to} className="block w-full">
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className="block w-full outline-none">
      {content}
    </button>
  );
}

export function SubscriptionItem({ item, isPinned }: { item: Subscription; isPinned?: boolean }) {
  return (
    <Link
      to={`/channel/${item.channelId}`}
      className="flex h-9 w-full items-center gap-4 rounded-lg px-3 text-left text-sm font-semibold transition-colors text-zinc-700 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-[#272727]"
    >
      {item.thumbnail ? (
        <ChannelAvatar channelId={item.channelId} src={item.thumbnail} title={item.title} sizeClassName="h-6 w-6" />
      ) : (
        <ChannelAvatar channelId={item.channelId} title={item.title} sizeClassName="h-6 w-6" />
      )}
      <span className="min-w-0 flex-1 truncate">{item.title}</span>
      {isPinned && <Pin size={12} className="shrink-0 text-zinc-400" />}
    </Link>
  );
}

export function AppSidebar({ className, showLogo, onClose, onClick, mini }: SidebarProps & { onClick?: (e: any) => void }) {
  const auth = useAuth();
  const appConfig = useAppConfig();
  const owner = { isAuthenticated: auth.isAuthenticated && Boolean(auth.user?.id), userId: auth.user?.id };
  const subscriptionsQuery = useQuery({
    queryKey: getSubscriptionQueryKey(owner),
    queryFn: () => listSubscriptions(owner),
    enabled: !auth.isLoading
  });

  const openStudio = () => {
    window.open('https://studio.youtube.com/', '_blank', 'noopener,noreferrer');
  };

  const subscriptions = subscriptionsQuery.data ?? [];
  const displaySubscriptions = subscriptions.slice(0, 7);

  if (mini) {
    return (
      <aside className={cn('w-[72px] px-1 py-1', className)} onClick={onClick}>
        <div className="flex flex-col gap-1">
          <MenuItem icon={Home} label="ホーム" to="/" mini />
          <MenuItem icon={SquarePlay} label="登録チャンネル" to="/subscriptions" mini />
          <MenuItem icon={Download} label="オフライン" to="/offline" mini />
          <MenuItem icon={UserCircle} label="マイページ" to="/mypage" mini />
          <MenuItem icon={Music} label="音楽" to="/music" mini />
        </div>
      </aside>
    );
  }

  return (
    <aside className={className} onClick={onClick}>
      {showLogo && (
        <div className="mb-2 flex h-14 items-center gap-3 px-1">
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full transition-colors text-zinc-700 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-[#272727]">
            <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
          </button>
          <Link to="/" className="inline-flex items-center gap-2" onClick={onClose}>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-white dark:bg-red-600">
              <PlaySquare size={18} />
            </span>
            <span className="text-lg font-bold text-zinc-900 dark:text-white">WhoTube</span>
          </Link>
        </div>
      )}

      <nav className="space-y-1 border-b pb-4 border-zinc-200 dark:border-zinc-800">
        <MenuItem icon={Home} label="ホーム" to="/" />
      </nav>

      <nav className="space-y-1 border-b py-4 border-zinc-200 dark:border-zinc-800">
        <MenuItem icon={ChevronRight} label="登録チャンネル" to="/subscriptions" trailing />
        {!auth.isAuthenticated ? (
          <p className="px-3 py-1 text-xs leading-5 text-zinc-500">未ログイン時はこのブラウザに保存されます</p>
        ) : null}
        {displaySubscriptions.map((item) => (
          <SubscriptionItem
            key={item.channelId}
            item={item}
            isPinned={(appConfig.data?.forcedSubscriptionChannelIds ?? []).includes(item.channelId)}
          />
        ))}
        {subscriptions.length > 7 && (
          <MenuItem icon={ChevronDown} label={`さらに ${subscriptions.length - 7} 件を表示`} to="/subscriptions" />
        )}
      </nav>

      <nav className="space-y-1 border-b py-4 border-zinc-200 dark:border-zinc-800">
        <MenuItem icon={ChevronRight} label="マイページ" to="/mypage" trailing />
        <MenuItem icon={Music} label="音楽" to="/music" />
        <MenuItem icon={Download} label="オフライン" to="/offline" />
        <MenuItem icon={History} label="履歴" to="/history" />
        <MenuItem icon={ListVideo} label="再生リスト" to="/playlist/list" />
        <MenuItem icon={Clock} label="後で見る" to="/playlist/WL" />
        <MenuItem icon={PlaySquare} label="作成した動画" onClick={openStudio} />
        <MenuItem icon={Settings} label="設定" to="/settings" />
      </nav>

      <nav className="space-y-1 pt-4">
        <p className="px-3 pb-2 text-sm font-bold text-zinc-900 dark:text-white">探索</p>
        <MenuItem icon={Radio} label="プレイヤー" to="/music/player" />
      </nav>
    </aside>
  );
}
