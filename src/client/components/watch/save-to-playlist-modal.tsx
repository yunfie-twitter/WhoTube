import { useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import type { VideoItem } from '../../lib/types';
import { createPlaylist, readPlaylists, saveVideoToPlaylist, seedDefaultPlaylists } from '../../lib/playlists';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  video: VideoItem;
}

export function SaveToPlaylistModal({ isOpen, onClose, video }: Props) {
  const [version, setVersion] = useState(0);
  const [newTitle, setNewTitle] = useState('');
  const playlists = useMemo(() => {
    seedDefaultPlaylists();
    return readPlaylists();
  }, [version, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-sm rounded-xl bg-[#282828] p-4 text-zinc-100 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white">再生リストに保存</h3>
          <button type="button" onClick={onClose} className="rounded-full p-2 hover:bg-[#3a3a3a]">
            <X size={18} />
          </button>
        </div>
        <div className="mt-4 space-y-2">
          {playlists.map((playlist) => (
            <button
              key={playlist.id}
              type="button"
              onClick={() => {
                saveVideoToPlaylist(playlist.id, video);
                onClose();
              }}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-semibold hover:bg-[#3a3a3a]"
            >
              <span>{playlist.title}</span>
              <span className="text-xs text-zinc-400">{playlist.videos.length} 本</span>
            </button>
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          <input
            value={newTitle}
            onChange={(event) => setNewTitle(event.target.value)}
            placeholder="新しい再生リスト"
            className="h-9 min-w-0 flex-1 rounded-lg border border-zinc-700 bg-[#181818] px-3 text-sm text-white outline-none"
          />
          <button
            type="button"
            onClick={() => {
              const playlist = createPlaylist(newTitle);
              saveVideoToPlaylist(playlist.id, video);
              setNewTitle('');
              setVersion((value) => value + 1);
              onClose();
            }}
            className="inline-flex h-9 items-center gap-1 rounded-lg bg-white px-3 text-sm font-bold text-zinc-950"
          >
            <Plus size={16} />
            作成
          </button>
        </div>
      </div>
    </div>
  );
}
