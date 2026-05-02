import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { History, Settings, SquarePlay, Upload, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { batchSubscribe } from '../lib/subscriptions';
import { useQueryClient } from '@tanstack/react-query';

const links = [
  { to: '/history', label: '履歴', icon: History },
  { to: '/subscriptions', label: '登録チャンネル', icon: SquarePlay },
  { to: '/settings', label: '設定', icon: Settings }
];

export function MyPage() {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [importCount, setImportCount] = useState(0);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportStatus('loading');
    try {
      const text = await file.text();
      const lines = text.split('\n');
      const payloads: { channelId: string; title: string }[] = [];

      // Google Takeout subscriptions.csv parser
      // Format: Channel Id,Channel URL,Channel Title
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Robust CSV parser to handle quotes, commas and spaces
        const parts: string[] = [];
        let current = '';
        let inQuotes = false;
        for (let j = 0; j < line.length; j++) {
          const char = line[j];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            parts.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        parts.push(current.trim());

        if (parts.length >= 3) {
          const channelId = parts[0].replace(/^"|"$/g, '');
          const title = parts[2].replace(/^"|"$/g, '');
          if (channelId && channelId.startsWith('UC')) {
            payloads.push({ channelId, title });
          }
        }
      }

      if (payloads.length === 0) {
        throw new Error('有効なデータが見つかりませんでした。Google Takeoutのsubscriptions.csvを選択してください。');
      }

      const owner = { isAuthenticated: auth.isAuthenticated && Boolean(auth.user?.id), userId: auth.user?.id };
      await batchSubscribe(owner, payloads);
      
      setImportCount(payloads.length);
      setImportStatus('success');
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      
      setTimeout(() => setImportStatus('idle'), 5000);
    } catch (err) {
      console.error('Import failed:', err);
      setImportStatus('error');
      setTimeout(() => setImportStatus('idle'), 5000);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-10 py-8">
      <section className="flex items-center gap-6">
        <div className="flex h-20 w-20 items-center justify-center rounded-full text-2xl font-bold bg-gradient-to-br from-zinc-100 to-zinc-200 text-zinc-900 shadow-inner dark:from-zinc-800 dark:to-zinc-900 dark:text-white">
          {(auth.user?.name || 'U').slice(0, 1)}
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
            {auth.isAuthenticated ? auth.user?.name || 'マイページ' : 'ゲスト'}
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400">
            {auth.isAuthenticated ? 'メンバーシップ アカウント' : 'サインインして同期を有効にする'}
          </p>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-3">
        {links.map((item) => {
          const Icon = item.icon;
          return (
            <Link 
              key={item.to} 
              to={item.to} 
              className="group flex flex-col gap-4 rounded-2xl border p-6 transition-all duration-300 border-zinc-200 bg-white hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:bg-[#121212] dark:hover:border-zinc-700 dark:hover:bg-[#181818]"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-50 text-zinc-600 group-hover:bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-400 dark:group-hover:bg-zinc-800">
                <Icon size={24} />
              </div>
              <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{item.label}</span>
            </Link>
          );
        })}
      </div>

      <section className="rounded-3xl border border-zinc-200 bg-zinc-50/50 p-8 dark:border-zinc-800 dark:bg-[#121212]/50">
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white">YouTube データのインポート</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Google Takeout の <code>subscriptions.csv</code> をアップロードして、一括でチャンネル登録できます。
            </p>
          </div>
          
          <div className="relative">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              accept=".csv" 
              className="hidden" 
            />
            <button
              onClick={handleImportClick}
              disabled={importStatus === 'loading'}
              className="flex items-center gap-2 rounded-full bg-zinc-900 px-6 py-3 text-sm font-bold text-white transition-all hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
            >
              {importStatus === 'loading' ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                <Upload size={18} />
              )}
              {importStatus === 'loading' ? 'インポート中...' : 'CSVをアップロード'}
            </button>

            {importStatus === 'success' && (
              <div className="absolute top-full mt-3 flex items-center gap-2 text-sm font-medium text-green-600 dark:text-green-400">
                <CheckCircle2 size={16} />
                <span>{importCount}個のチャンネルをインポートしました</span>
              </div>
            )}
            
            {importStatus === 'error' && (
              <div className="absolute top-full mt-3 flex items-center gap-2 text-sm font-medium text-red-600 dark:text-red-400">
                <AlertCircle size={16} />
                <span>インポートに失敗しました</span>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
