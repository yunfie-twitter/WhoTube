import { useState, useEffect } from 'react';
import { 
  Shield, 
  Activity, 
  Bell, 
  Trash2, 
  Send, 
  Clock, 
  Cpu, 
  HardDrive,
  RefreshCcw,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { cn } from '../lib/utils';

interface SystemMetrics {
  uptime: number;
  memory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
  };
}

interface GlobalNotification {
  id: number;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  createdAt: string;
}

export function AdminWebUIPage() {
  const [token, setToken] = useState(() => localStorage.getItem('whotube:admin-token') || '');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [notifications, setNotifications] = useState<GlobalNotification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // New notification form
  const [msg, setMsg] = useState('');
  const [type, setType] = useState<'info' | 'warning' | 'error' | 'success'>('info');

  const fetchAdminData = async (activeToken: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const headers = { 'Authorization': `Bearer ${activeToken}` };
      
      const [metricsRes, notificationsRes] = await Promise.all([
        fetch('/metrics').then(r => r.json()),
        fetch('/api/notifications').then(r => r.json())
      ]);

      setMetrics(metricsRes);
      setNotifications(notificationsRes);
      setIsAuthorized(true);
      localStorage.setItem('whotube:admin-token', activeToken);
    } catch (err: any) {
      setError('データの取得に失敗しました。トークンが正しいか確認してください。');
      setIsAuthorized(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchAdminData(token);
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    fetchAdminData(token);
  };

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!msg.trim()) return;

    try {
      const res = await fetch('/api/admin/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ message: msg, type })
      });

      if (!res.ok) throw new Error('送信に失敗しました');

      setMsg('');
      setSuccess('通知を送信しました');
      setTimeout(() => setSuccess(null), 3000);
      fetchAdminData(token);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteNotification = async (id: number) => {
    if (!confirm('この通知を削除しますか？')) return;
    try {
      const res = await fetch(`/api/admin/notifications/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('削除に失敗しました');
      fetchAdminData(token);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / (3600 * 24));
    const hrs = Math.floor((seconds % (3600 * 24)) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hrs}h ${mins}m`;
  };

  const formatMB = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

  if (!isAuthorized) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center px-4">
        <div className="w-full max-w-md overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-[#1a1a1a]">
          <div className="bg-zinc-900 p-8 text-center text-white dark:bg-zinc-950">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/10">
              <Shield className="h-8 w-8 text-red-500" />
            </div>
            <h1 className="text-2xl font-bold">Admin WebUI</h1>
            <p className="mt-2 text-sm text-zinc-400">管理者用トークンを入力してログインしてください</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-6 p-8">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Admin Secret Token</label>
              <Input 
                type="password" 
                placeholder="••••••••••••" 
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="h-12 bg-zinc-50 dark:bg-zinc-900/50"
              />
            </div>
            <Button type="submit" disabled={isLoading} className="w-full h-12 text-base font-semibold bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200">
              {isLoading ? <RefreshCcw className="h-5 w-5 animate-spin" /> : '認証する'}
            </Button>
            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-6xl space-y-8 px-4 py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
            <Shield className="h-8 w-8 text-red-600" />
            Admin Dashboard
          </h1>
          <p className="mt-1 text-zinc-500">WhoTube インスタンスの管理とシステム状況の監視</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => fetchAdminData(token)} disabled={isLoading} className="rounded-full">
            <RefreshCcw className={cn("mr-2 h-4 w-4", isLoading && "animate-spin")} />
            更新
          </Button>
          <Button variant="ghost" size="sm" onClick={() => {
            localStorage.removeItem('whotube:admin-token');
            setIsAuthorized(false);
          }} className="rounded-full text-zinc-500 hover:text-red-500">
            ログアウト
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Metrics Cards */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-[#1a1a1a]">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
              <Clock className="h-5 w-5" />
            </div>
            <span className="text-xs font-medium text-zinc-400">UPTIME</span>
          </div>
          <div className="text-2xl font-bold">{metrics ? formatUptime(metrics.uptime) : '---'}</div>
          <p className="mt-1 text-sm text-zinc-500">サーバー稼働時間</p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-[#1a1a1a]">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400">
              <Cpu className="h-5 w-5" />
            </div>
            <span className="text-xs font-medium text-zinc-400">MEMORY</span>
          </div>
          <div className="text-2xl font-bold">{metrics ? formatMB(metrics.memory.heapUsed) : '---'}</div>
          <p className="mt-1 text-sm text-zinc-500">Heap Used / {metrics ? formatMB(metrics.memory.heapTotal) : '---'}</p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-[#1a1a1a]">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400">
              <HardDrive className="h-5 w-5" />
            </div>
            <span className="text-xs font-medium text-zinc-400">RSS</span>
          </div>
          <div className="text-2xl font-bold">{metrics ? formatMB(metrics.memory.rss) : '---'}</div>
          <p className="mt-1 text-sm text-zinc-500">Resident Set Size</p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Notification Management */}
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-red-500" />
            <h2 className="text-xl font-bold">グローバル通知</h2>
          </div>

          <form onSubmit={handleSendNotification} className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-[#1a1a1a]">
            <h3 className="font-bold">新しい通知を作成</h3>
            <div className="space-y-2">
              <textarea 
                placeholder="全ユーザーに表示されるメッセージを入力してください..."
                value={msg}
                onChange={(e) => setMsg(e.target.value)}
                className="min-h-[100px] w-full rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-800 dark:bg-zinc-900/50 dark:focus:ring-white"
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {(['info', 'warning', 'error', 'success'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={cn(
                    "rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-all",
                    type === t 
                      ? (t === 'info' ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30" :
                         t === 'warning' ? "bg-amber-600 text-white shadow-lg shadow-amber-500/30" :
                         t === 'error' ? "bg-red-600 text-white shadow-lg shadow-red-500/30" :
                         "bg-emerald-600 text-white shadow-lg shadow-emerald-500/30")
                      : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400"
                  )}
                >
                  {t}
                </button>
              ))}
              <div className="flex-1" />
              <Button type="submit" disabled={!msg.trim()} className="bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200">
                <Send className="mr-2 h-4 w-4" />
                送信する
              </Button>
            </div>
            {success && (
              <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
                {success}
              </div>
            )}
          </form>

          <div className="space-y-3">
            <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-widest px-1">配信中の通知 ({notifications.length})</h3>
            {notifications.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-200 py-12 text-center text-zinc-400 dark:border-zinc-800">
                アクティブな通知はありません
              </div>
            ) : (
              <div className="grid gap-3">
                {notifications.map((n) => (
                  <div 
                    key={n.id} 
                    className={cn(
                      "group flex items-start gap-4 rounded-2xl border border-zinc-200 bg-white p-4 transition-all hover:shadow-md dark:border-zinc-800 dark:bg-[#1a1a1a]",
                      n.type === 'warning' ? "border-amber-100 bg-amber-50/30 dark:border-amber-900/20" :
                      n.type === 'error' ? "border-red-100 bg-red-50/30 dark:border-red-900/20" :
                      n.type === 'success' ? "border-emerald-100 bg-emerald-50/30 dark:border-emerald-900/20" :
                      ""
                    )}
                  >
                    <div className={cn(
                      "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                      n.type === 'warning' ? "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400" :
                      n.type === 'error' ? "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400" :
                      n.type === 'success' ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400" :
                      "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400"
                    )}>
                      <Bell className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-relaxed">{n.message}</p>
                      <p className="mt-1 text-xs text-zinc-500">{new Date(n.createdAt).toLocaleString('ja-JP')}</p>
                    </div>
                    <button 
                      onClick={() => handleDeleteNotification(n.id)}
                      className="opacity-0 transition-opacity group-hover:opacity-100 p-2 text-zinc-400 hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick Links / Resources */}
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-500" />
            <h2 className="text-xl font-bold">システムリソース</h2>
          </div>

          <div className="grid gap-4">
            <a 
              href="/docs" 
              target="_blank" 
              className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white p-5 transition-all hover:bg-zinc-50 dark:border-zinc-800 dark:bg-[#1a1a1a] dark:hover:bg-zinc-900/50"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-white">
                  <ExternalLink className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-bold">API Documentation</div>
                  <div className="text-xs text-zinc-500">Swagger UI でエンドポイントを確認</div>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-zinc-400" />
            </a>

            <div className="rounded-2xl border border-zinc-200 bg-zinc-50/50 p-6 dark:border-zinc-800 dark:bg-zinc-900/20">
              <h3 className="font-bold mb-4">環境変数</h3>
              <div className="space-y-3">
                {[
                  { label: 'NODE_ENV', value: 'production' },
                  { label: 'PORT', value: '3000' },
                  { label: 'LOGTO', value: 'Enabled' }
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between border-b border-zinc-200 pb-2 last:border-0 dark:border-zinc-800">
                    <span className="text-xs font-bold text-zinc-500 uppercase">{item.label}</span>
                    <code className="text-xs bg-white px-2 py-1 rounded dark:bg-zinc-900">{item.value}</code>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl bg-zinc-900 p-8 text-white shadow-2xl dark:bg-white dark:text-black">
              <h3 className="text-xl font-bold">WhoTube v4.0</h3>
              <p className="mt-2 text-sm text-zinc-400 dark:text-zinc-500">
                WhoTube Instance Management Console.<br/>
                インスタンスの健康状態を監視し、全ユーザーに向けたアナウンスメントを送信できます。
              </p>
              <Button className="mt-6 w-full bg-white text-black hover:bg-zinc-200 dark:bg-black dark:text-white dark:hover:bg-zinc-800">
                システムの詳細ログを確認 (Beta)
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
