import { Download, Trash2, Play, ArrowLeft, Search, MoreVertical } from 'lucide-react';
import { Link } from 'react-router-dom';
import { offlineManager, OfflineVideoMetadata } from '../lib/offline';
import { proxyImageUrl } from '../lib/images';
import { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { cn } from '../lib/utils';
import React from 'react';

export function DownloadsPage() {
  const [videos, setVideos] = useState<OfflineVideoMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadVideos = async () => {
    setIsLoading(true);
    try {
      const list = await offlineManager.getVideos();
      setVideos(list.sort((a, b) => b.addedAt - a.addedAt));
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadVideos();
  }, []);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm('この動画を削除しますか？')) {
      await offlineManager.deleteVideo(id);
      loadVideos();
    }
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-zinc-50 transition-colors duration-300 dark:bg-[#0f0f0f]">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-zinc-200 bg-white/80 px-4 backdrop-blur-md dark:border-zinc-800 dark:bg-[#0f0f0f]/80">
        <div className="flex items-center gap-4">
          <Link to="/" className="rounded-full p-2 text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-white/10">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-lg font-black tracking-tight">オフライン</h1>
        </div>
        <div className="flex items-center gap-2">
          <button className="rounded-full p-2 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-white/10">
            <Search size={20} />
          </button>
          <button className="rounded-full p-2 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-white/10">
            <MoreVertical size={20} />
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 p-4 md:p-6 lg:p-8">
        {isLoading ? (
          <div className="flex h-60 flex-col items-center justify-center gap-4">
            <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-zinc-200 border-t-zinc-900 dark:border-zinc-800 dark:border-t-zinc-100" />
            <p className="text-sm font-bold text-zinc-500 animate-pulse">読み込み中...</p>
          </div>
        ) : videos.length === 0 ? (
          <div className="flex h-[60vh] flex-col items-center justify-center gap-6 text-center animate-in fade-in zoom-in duration-700">
            <div className="relative">
              <div className="absolute inset-0 animate-ping rounded-full bg-blue-500/10" />
              <div className="relative rounded-full bg-gradient-to-br from-zinc-100 to-zinc-200 p-8 dark:from-white/5 dark:to-white/10 shadow-inner">
                <Download size={56} className="text-zinc-400 dark:text-zinc-600" />
              </div>
            </div>
            <div className="max-w-xs space-y-2">
              <p className="text-xl font-black text-zinc-900 dark:text-white">オフライン動画はありません</p>
              <p className="text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
                お気に入りの動画を保存して、飛行機の中や電波の届かない場所でも楽しみましょう。
              </p>
            </div>
            <Link to="/">
              <Button className="h-11 rounded-full bg-zinc-900 px-8 font-bold text-white transition-all hover:scale-105 active:scale-95 dark:bg-white dark:text-zinc-950">
                動画を探す
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-zinc-500">{videos.length} 本の動画</p>
            </div>
            <div className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {videos.map((video, i) => (
                <div
                  key={video.id}
                  className="group relative flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-4 duration-500"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <Link
                    to={`/watch/${video.id}?offline=1`}
                    className="relative aspect-video overflow-hidden rounded-2xl bg-zinc-200 shadow-sm transition-all dark:bg-zinc-800 ring-1 ring-black/5 dark:ring-white/5"
                  >
                    <img
                      src={proxyImageUrl(video.thumbnail)}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110 group-hover:blur-[2px]"
                      alt={video.title}
                      loading="lazy"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-all duration-300 group-hover:opacity-100">
                      <div className="transform scale-75 rounded-full bg-white/20 p-4 backdrop-blur-xl transition-transform duration-300 group-hover:scale-100 border border-white/30">
                        <Play size={32} className="fill-white text-white ml-1" />
                      </div>
                    </div>
                    {video.durationText && (
                      <span className="absolute bottom-2.5 right-2.5 rounded-lg bg-black/80 px-2 py-1 text-[11px] font-black tracking-tight text-white backdrop-blur-sm">
                        {video.durationText}
                      </span>
                    )}
                    <div className="absolute top-2.5 left-2.5">
                      <div className="flex items-center gap-1.5 rounded-full bg-blue-600/90 px-2 py-1 text-[10px] font-black text-white shadow-lg backdrop-blur-sm">
                        <Download size={10} className="fill-white" />
                        SAVED
                      </div>
                    </div>
                  </Link>
                  <div className="flex gap-3 px-1">
                    <div className="flex flex-1 flex-col gap-1.5 overflow-hidden">
                      <Link to={`/watch/${video.id}?offline=1`} className="line-clamp-2 text-[15px] font-bold leading-tight text-zinc-900 transition-colors hover:text-blue-600 dark:text-zinc-100 dark:hover:text-blue-400">
                        {video.title}
                      </Link>
                      <div className="flex flex-col gap-0.5">
                        <p className="truncate text-[13px] font-medium text-zinc-500 dark:text-zinc-400">{video.author}</p>
                        <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
                          {new Date(video.addedAt).toLocaleDateString('ja-JP')} に保存
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={(e) => handleDelete(video.id, e)}
                      className="mt-1 h-9 w-9 shrink-0 rounded-full flex items-center justify-center text-zinc-400 transition-all hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30"
                      title="削除"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
