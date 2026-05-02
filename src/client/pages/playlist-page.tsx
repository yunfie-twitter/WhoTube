import { useEffect, useMemo, useState } from 'react';
import { cn } from '../lib/utils';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ListVideo, MoreVertical, Plus } from 'lucide-react';
import { getPlaylist } from '../lib/api';
import { VideoGrid } from '../components/video/video-grid';
import { createPlaylist, createPlaylistWithVideos, readPlaylists, seedDefaultPlaylists } from '../lib/playlists';
import { proxyImageUrl } from '../lib/images';
import { ErrorPage } from './error-page';

export function PlaylistPage() {
  const { id: paramId = '' } = useParams();
  const [searchParams] = useSearchParams();
  const id = paramId || searchParams.get('list') || '';
  const [version, setVersion] = useState(0);
  const [newTitle, setNewTitle] = useState('');

  useEffect(() => {
    seedDefaultPlaylists();
    const onChange = () => setVersion((value) => value + 1);
    window.addEventListener('whotube:playlists-changed', onChange);
    return () => window.removeEventListener('whotube:playlists-changed', onChange);
  }, []);

  const localPlaylists = useMemo(() => readPlaylists(), [version]);
  const localPlaylist = localPlaylists.find((playlist) => playlist.id === id);
  const query = useQuery({
    queryKey: ['playlist', id],
    queryFn: () => getPlaylist(id),
    enabled: Boolean(id && id !== 'list' && !localPlaylist)
  });

  if (id === 'list') {
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">再生リスト</h1>
          <div className="flex gap-2">
            <input
              value={newTitle}
              onChange={(event) => setNewTitle(event.target.value)}
              placeholder="新しい再生リスト"
              className="h-10 rounded-full border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-[#181818] dark:text-white dark:focus:border-zinc-500 transition-colors"
            />
            <button
              type="button"
              onClick={() => {
                createPlaylist(newTitle);
                setNewTitle('');
                setVersion((value) => value + 1);
              }}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-zinc-900 px-4 text-sm font-bold text-white dark:bg-white dark:text-zinc-950 transition-transform active:scale-95"
            >
              <Plus size={18} />
              新規作成
            </button>
          </div>
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {['新しい順', '再生リスト', '音楽', 'ミックス', 'コース', '自分が所有', '保存済み'].map((item, index) => (
            <button 
              key={item} 
              className={cn(
                'shrink-0 rounded-lg px-3 py-1.5 text-sm font-bold transition-colors',
                index === 0 
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950' 
                  : 'bg-zinc-200 text-zinc-700 hover:bg-zinc-300 dark:bg-[#272727] dark:text-white dark:hover:bg-[#3f3f3f]'
              )}
            >
              {item}
            </button>
          ))}
        </div>
        <div className="grid gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {localPlaylists.map((playlist) => {
            const coverVideos = playlist.videos.slice(0, 3);
            const cover = coverVideos[0]?.thumbnail;
            return (
              <Link key={playlist.id} to={`/playlist/${playlist.id}`} className="group block">
                <div className="relative aspect-video overflow-hidden rounded-lg bg-zinc-200 dark:bg-zinc-800 shadow-[0_-4px_0_rgba(113,113,122,.7),0_-8px_0_rgba(63,63,70,.65)]">
                  {cover ? (
                    <img src={proxyImageUrl(cover)} alt="" className="h-full w-full object-cover transition group-hover:scale-105" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-zinc-400 dark:text-zinc-500">
                      <ListVideo size={36} />
                    </div>
                  )}
                  <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded bg-black/70 px-2 py-1 text-xs font-bold text-white">
                    <ListVideo size={13} />
                    {playlist.videos.length} 本の動画
                  </span>
                </div>
                <div className="mt-3 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-bold text-zinc-900 dark:text-white">{playlist.title}</h2>
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{playlist.privacy === 'private' ? '非公開' : '公開'}・プレイリスト</p>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">再生リストの全体を見る</p>
                  </div>
                  <MoreVertical size={18} className="text-zinc-400" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    );
  }

  if (localPlaylist) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{localPlaylist.title}</h1>
        <VideoGrid items={localPlaylist.videos} />
      </div>
    );
  }

  if (query.isLoading) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading playlist...</p>;
  }

  if (query.isError) {
    return <ErrorPage type="unavailable" title="再生リストを読み込めません" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{query.data?.title ?? `Playlist ${id}`}</h1>
        <button
          type="button"
          onClick={() => {
            if (!query.data) return;
            createPlaylistWithVideos(query.data.title, query.data.videos);
            setVersion((value) => value + 1);
          }}
          className="inline-flex h-10 items-center gap-2 rounded-full bg-zinc-900 px-4 text-sm font-bold text-white dark:bg-white dark:text-zinc-950 transition-all active:scale-95"
        >
          <Plus size={18} />
          この再生リストを保存
        </button>
      </div>
      <VideoGrid items={query.data?.videos ?? []} />
    </div>
  );
}
