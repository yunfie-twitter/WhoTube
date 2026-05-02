import type { VideoItem } from './types';

const HISTORY_KEY = 'whotube:watched-videos';

export function readHistory(): VideoItem[] {
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeHistory(items: VideoItem[]) {
  window.localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, 100)));
}

export function addHistoryItem(video: VideoItem) {
  const next = [
    {
      ...video,
      watchedAt: new Date().toISOString()
    },
    ...readHistory().filter((item) => item.id !== video.id)
  ];
  writeHistory(next);
}

export function clearHistory() {
  window.localStorage.removeItem(HISTORY_KEY);
}
