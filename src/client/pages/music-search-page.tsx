import { useQuery } from '@tanstack/react-query';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Loader2, Music, Search } from 'lucide-react';
import { searchTracks } from '../lib/api';
import { VideoGrid } from '../components/video/video-grid';
import { QueueManager } from '../lib/queue';

export function MusicSearchPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const query = searchParams.get('q') || '';

  const { data: results, isLoading } = useQuery({
    queryKey: ['music-search', query],
    queryFn: () => searchTracks(query),
    enabled: !!query
  });

  return (
    <div className="space-y-6 pb-24">
      <header className="flex items-center gap-4 border-b border-white/10 pb-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-900 text-white shadow-lg">
          <Search size={24} />
        </div>
        <div>
          <h1 className="text-3xl font-black text-white">「{query}」の検索結果</h1>
          <p className="text-sm text-zinc-500">YouTube Music から楽曲を探しています</p>
        </div>
      </header>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-zinc-500" />
        </div>
      ) : results && results.length > 0 ? (
        <VideoGrid 
          items={results} 
          onVideoClick={(video) => {
            const index = results.findIndex(v => v.id === video.id);
            QueueManager.setQueue(results, index !== -1 ? index : 0);
            navigate(`/music/player?v=${video.id}`);
          }}
        />
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Music size={64} className="mb-4 text-zinc-800" />
          <h3 className="text-xl font-bold text-zinc-400">楽曲が見つかりませんでした</h3>
          <p className="text-zinc-600">別のキーワードを試してみてください</p>
        </div>
      )}
    </div>
  );
}
