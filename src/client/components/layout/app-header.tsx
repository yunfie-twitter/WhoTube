import { FormEvent, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { cn } from '../../lib/utils';
import {
  Menu,
  PlaySquare,
  Plus,
  Search,
  Bell,
  LogIn,
  LogOut,
  UserCircle
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { AppSidebar } from './app-sidebar';
import { useAuth } from '../../lib/auth';
import { useSubscriptionNotifications } from '../../hooks/use-subscription-notifications';
import { NotificationsPopover } from './notifications-popover';
import { useGlobalNotifications } from '../../hooks/use-notifications';
import { getLastSeenAt, readNotificationItems, setLastSeenAt } from '../../lib/notifications';
import { useEffect } from 'react';

const ENABLE_NOTIFICATIONS = import.meta.env.VITE_ENABLE_NOTIFICATIONS !== 'false';
const ENABLE_SIGNIN = import.meta.env.VITE_ENABLE_SIGNIN !== 'false';

interface Props {
  dark?: boolean;
  compact?: boolean;
  onMenuClick?: () => void;
}

export function AppHeader({ dark = false, compact = false, onMenuClick }: Props) {
  const navigate = useNavigate();
  const auth = useAuth();
  const notifications = useSubscriptionNotifications();
  const [keyword, setKeyword] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const { data: globalNotifications } = useGlobalNotifications();
  const [hasUnread, setHasUnread] = useState(false);

  useEffect(() => {
    const checkUnread = () => {
      const lastSeen = getLastSeenAt();
      const items = readNotificationItems();
      const hasUnreadSubscription = items.some(item => item.notifiedAt > lastSeen);
      const hasUnreadGlobal = globalNotifications?.some(n => n.createdAt > lastSeen) ?? false;
      setHasUnread(hasUnreadSubscription || hasUnreadGlobal);
    };

    checkUnread();
    window.addEventListener('whotube:notifications-changed', checkUnread);
    return () => window.removeEventListener('whotube:notifications-changed', checkUnread);
  }, [globalNotifications]);

  function handleMenuClick() {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;

    if (compact) {
      window.dispatchEvent(new CustomEvent('whotube:toggle-menu'));
    } else if (isMobile) {
      setMenuOpen(true);
    } else if (onMenuClick) {
      onMenuClick();
    }
  }

  const location = useLocation();
  const isMusicSection = location.pathname.startsWith('/music');

  function onSearch(e: FormEvent) {
    e.preventDefault();
    if (!keyword.trim()) return;
    
    if (isMusicSection) {
      navigate(`/music/search?q=${encodeURIComponent(keyword.trim())}`);
    } else {
      navigate(`/search?q=${encodeURIComponent(keyword.trim())}`);
    }
  }

  function onCreate() {
    const ok = window.confirm('外部サイトに移動します。YouTube Studio を開きますか？');
    if (ok) {
      window.open('https://studio.youtube.com/', '_blank', 'noopener,noreferrer');
    }
  }

  async function onAuthClick() {
    if (auth.isAuthenticated) {
      await auth.signOut();
      return;
    }

    await auth.signIn();
  }

  return (
    <>
      <header className="sticky top-0 z-30 transition-colors duration-300 border-b border-zinc-200/80 bg-white/80 backdrop-blur dark:border-zinc-800/50 dark:bg-[#0f0f0f]/95">
        <div className="flex h-14 items-center gap-1.5 px-2 sm:gap-3 sm:px-4">
          <Button 
            size="icon" 
            variant="ghost" 
            onClick={handleMenuClick} 
            className="h-9 w-9 rounded-full transition-colors text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-100 dark:hover:bg-[#272727] dark:hover:text-white"
          >
            <Menu size={20} />
          </Button>
          
          <Link to="/" className="inline-flex min-w-0 items-center gap-1.5 sm:gap-2">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-900 text-white dark:bg-red-600">
              <PlaySquare size={18} />
            </span>
            <span className="hidden text-base font-bold tracking-tight text-zinc-900 min-[380px]:inline sm:text-xl dark:text-white">WhoTube</span>
          </Link>

          <form onSubmit={onSearch} className="mx-1 flex min-w-0 flex-1 gap-2 sm:mx-auto sm:max-w-2xl">
            <div className="relative flex-1">
              <Input
                placeholder={isMusicSection ? "楽曲を検索" : "検索"}
                className="h-10 w-full rounded-full border-zinc-200 bg-zinc-50 px-3 pr-9 text-sm placeholder:text-zinc-400 focus-visible:ring-1 focus-visible:ring-zinc-300 sm:px-4 sm:pr-11 dark:h-9 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white dark:placeholder:text-zinc-500 dark:focus-visible:ring-zinc-700"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
              />
              <button type="submit" className="absolute inset-y-0 right-0 flex items-center px-3 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 sm:px-4">
                <Search size={17} />
              </button>
            </div>
          </form>

          <div className="relative flex shrink-0 items-center gap-0.5 sm:gap-2">
            <Button size="icon" variant="ghost" onClick={onCreate} className="h-8 w-8 text-zinc-500 hover:bg-zinc-100 dark:h-8 dark:w-8 dark:rounded-full dark:text-zinc-400 dark:hover:bg-[#272727] dark:hover:text-white sm:h-10 sm:w-10">
              <Plus size={18} />
            </Button>
            {ENABLE_NOTIFICATIONS && (
              <>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    setNotificationsOpen((value) => {
                      const next = !value;
                      if (next) {
                        setLastSeenAt(new Date().toISOString());
                      }
                      return next;
                    });
                    if (!notifications.enabled) void notifications.enableNotifications();
                  }}
                  className={cn(
                    "h-8 w-8 transition-colors sm:h-10 sm:w-10",
                    notifications.enabled ? "text-zinc-900 dark:text-white" : "text-zinc-400 hover:bg-zinc-100 dark:hover:bg-[#272727] dark:hover:text-white"
                  )}
                  title="通知"
                  disabled={notifications.isChecking}
                >
                  <div className="relative">
                    <Bell size={18} className={notifications.enabled ? 'fill-current' : ''} />
                    {hasUnread && (
                      <span className="absolute -right-0.5 -top-0.5 flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-red-600"></span>
                      </span>
                    )}
                  </div>
                </Button>
                <NotificationsPopover open={notificationsOpen} />
              </>
            )}
            {ENABLE_SIGNIN && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onAuthClick}
                className="h-8 gap-1 px-2 text-zinc-500 hover:bg-zinc-100 dark:h-8 dark:gap-1 dark:rounded-full dark:px-2 dark:text-zinc-300 dark:hover:bg-[#272727] dark:hover:text-white sm:h-10 sm:gap-2 sm:px-3"
                title={auth.isAuthenticated ? 'サインアウト' : 'サインイン'}
              >
                {auth.isAuthenticated ? <LogOut size={18} /> : auth.isLogtoEnabled ? <LogIn size={18} /> : <UserCircle size={18} />}
                <span className="hidden max-w-28 truncate text-sm font-semibold sm:inline">
                  {auth.isAuthenticated ? auth.user?.name ?? 'サインアウト' : 'サインイン'}
                </span>
              </Button>
            )}
          </div>
        </div>
      </header>

      {menuOpen ? (
        <div className="fixed inset-0 z-[100] bg-black/45 backdrop-blur-sm" onClick={() => setMenuOpen(false)}>
          <AppSidebar
            showLogo
            onClose={() => setMenuOpen(false)}
            className="h-full w-[246px] overflow-y-auto bg-white px-3 pb-6 text-zinc-900 shadow-2xl dark:bg-[#0f0f0f] dark:text-zinc-100 transition-colors duration-300"
            onClick={(event: any) => event.stopPropagation()}
          />
        </div>
      ) : null}
    </>
  );
}
