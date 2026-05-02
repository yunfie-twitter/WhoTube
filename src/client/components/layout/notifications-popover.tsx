import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MoreVertical, Settings } from 'lucide-react';
import { readNotificationItems } from '../../lib/notifications';
import { ChannelAvatar } from '../video/channel-avatar';
import { proxyImageUrl } from '../../lib/images';
import { useGlobalNotifications } from '../../hooks/use-notifications';
import { Megaphone, Info, AlertTriangle, AlertCircle, CheckCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

export function NotificationsPopover({ open }: { open: boolean }) {
  const [version, setVersion] = useState(0);
  const items = useMemo(() => readNotificationItems(), [version, open]);
  const { data: globalNotifications } = useGlobalNotifications();

  useEffect(() => {
    const onChange = () => setVersion((value) => value + 1);
    window.addEventListener('whotube:notifications-changed', onChange);
    return () => window.removeEventListener('whotube:notifications-changed', onChange);
  }, []);

  if (!open) return null;

  return (
    <div className="absolute right-3 top-12 z-50 w-[min(430px,calc(100vw-24px))] overflow-hidden rounded-xl border border-zinc-700 bg-[#282828] text-zinc-100 shadow-2xl">
      <div className="flex h-12 items-center justify-between border-b border-zinc-700 px-4">
        <h2 className="text-base font-bold text-white">通知</h2>
        <Link to="/settings" className="rounded-full p-2 text-zinc-200 hover:bg-[#3a3a3a]">
          <Settings size={18} />
        </Link>
      </div>
      <div className="max-h-[70vh] overflow-y-auto py-2">
        {/* Global Notifications */}
        {globalNotifications && globalNotifications.length > 0 && (
          <div className="mb-4 border-b border-zinc-700/50 pb-2">
            <p className="px-4 py-1 text-xs font-bold uppercase tracking-wider text-red-500">運営者からの連絡</p>
            {globalNotifications.map((n) => (
              <div 
                key={`global-${n.id}`} 
                className={cn(
                  "px-4 py-3 hover:bg-[#3a3a3a] transition-colors",
                  n.type === 'warning' ? "bg-amber-500/5" :
                  n.type === 'error' ? "bg-red-500/5" :
                  n.type === 'success' ? "bg-emerald-500/5" :
                  "bg-transparent"
                )}
              >
                <div className="flex gap-3">
                  <div className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                    n.type === 'warning' ? "bg-amber-900/40 text-amber-500" :
                    n.type === 'error' ? "bg-red-900/40 text-red-500" :
                    n.type === 'success' ? "bg-emerald-900/40 text-emerald-500" :
                    "bg-blue-900/40 text-blue-500"
                  )}>
                    {n.type === 'warning' ? <AlertTriangle size={18} /> :
                     n.type === 'error' ? <AlertCircle size={18} /> :
                     n.type === 'success' ? <CheckCircle size={18} /> :
                     <Megaphone size={18} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-relaxed text-white">
                      {n.message}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">{new Date(n.createdAt).toLocaleString('ja-JP')}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="px-4 py-2 text-sm font-bold text-white">最新のアップロード</p>
        {items.length ? items.map((item) => (
          <Link key={`${item.id}-${item.notifiedAt}`} to={`/watch/${item.id}?autoplay=1`} className="grid grid-cols-[42px_1fr_96px_24px] gap-3 px-4 py-3 hover:bg-[#3a3a3a]">
            <ChannelAvatar channelId={item.channelId} src={item.channelThumbnail} title={item.channelTitle} sizeClassName="h-10 w-10" />
            <div className="min-w-0">
              <p className="line-clamp-3 text-sm font-semibold leading-5 text-white">
                {item.channelTitle || 'チャンネル'} が「{item.title}」をアップロードしました
              </p>
              <p className="mt-1 text-xs text-zinc-400">{new Date(item.notifiedAt).toLocaleString('ja-JP')}</p>
            </div>
            {item.thumbnail ? <img src={proxyImageUrl(item.thumbnail)} alt="" className="aspect-video w-24 rounded object-cover" /> : <div className="aspect-video w-24 rounded bg-zinc-800" />}
            <MoreVertical size={18} className="mt-1 text-zinc-300" />
          </Link>
        )) : !globalNotifications?.length ? (
          <p className="px-4 py-8 text-center text-sm text-zinc-400">通知はまだありません。</p>
        ) : null}
      </div>
    </div>
  );
}
