import type { VideoItem } from './types';

const PLAYLISTS_KEY = 'whotube:playlists';

export interface LocalPlaylist {
  id: string;
  title: string;
  privacy: 'private' | 'public';
  videos: VideoItem[];
  updatedAt: string;
}

export function readPlaylists(): LocalPlaylist[] {
  try {
    const raw = window.localStorage.getItem(PLAYLISTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writePlaylists(playlists: LocalPlaylist[]) {
  window.localStorage.setItem(PLAYLISTS_KEY, JSON.stringify(playlists));
  window.dispatchEvent(new CustomEvent('whotube:playlists-changed'));
}

export function createPlaylist(title: string) {
  const playlist: LocalPlaylist = {
    id: `local-${Date.now()}`,
    title: title.trim() || '新しい再生リスト',
    privacy: 'private',
    videos: [],
    updatedAt: new Date().toISOString()
  };
  writePlaylists([playlist, ...readPlaylists()]);
  return playlist;
}

export function createPlaylistWithVideos(title: string, videos: VideoItem[]) {
  const playlist = createPlaylist(title);
  const playlists = readPlaylists();
  writePlaylists(playlists.map((item) => item.id === playlist.id
    ? { ...item, videos, updatedAt: new Date().toISOString() }
    : item));
  return playlist;
}

export function saveVideoToPlaylist(playlistId: string, video: VideoItem) {
  const playlists = readPlaylists();
  writePlaylists(playlists.map((playlist) => playlist.id === playlistId
    ? {
        ...playlist,
        videos: [video, ...playlist.videos.filter((item) => item.id !== video.id)],
        updatedAt: new Date().toISOString()
      }
    : playlist));
}

export function seedDefaultPlaylists() {
  if (readPlaylists().length) return;
  writePlaylists([
    {
      id: 'watch-later',
      title: '後で見る',
      privacy: 'private',
      videos: [],
      updatedAt: new Date().toISOString()
    },
    {
      id: 'saved',
      title: '保存済み',
      privacy: 'private',
      videos: [],
      updatedAt: new Date().toISOString()
    }
  ]);
}
