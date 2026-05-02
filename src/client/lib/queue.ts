import type { VideoItem } from './types';

export interface QueueState {
  items: VideoItem[];
  currentIndex: number;
  isPlaying: boolean;
  repeatMode: 'none' | 'all' | 'one';
  isShuffle: boolean;
}

const STORAGE_KEY = 'whotube:playback-queue';

function getInitialState(): QueueState {
  try {
    const saved = window.sessionStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return { 
        ...parsed, 
        isPlaying: false,
        repeatMode: parsed.repeatMode || 'none',
        isShuffle: parsed.isShuffle || false
      };
    }
  } catch (e) {}
  return { items: [], currentIndex: -1, isPlaying: false, repeatMode: 'none', isShuffle: false };
}

let state: QueueState = getInitialState();

function save() {
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, isPlaying: false }));
  window.dispatchEvent(new CustomEvent('whotube:queue-changed', { detail: state }));
}

export const QueueManager = {
  get state() { return state; },

  setQueue(items: VideoItem[], startIndex = 0) {
    const validIndex = startIndex >= 0 && startIndex < items.length ? startIndex : 0;
    state = { ...state, items: [...items], currentIndex: validIndex, isPlaying: true };
    save();
  },

  addToQueue(video: VideoItem) {
    if (state.items.find(i => i.id === video.id)) return;
    state.items.push(video);
    if (state.currentIndex === -1) {
      state.currentIndex = 0;
      state.isPlaying = true;
    }
    save();
  },

  next() {
    if (state.repeatMode === 'one') {
      save();
      return state.items[state.currentIndex];
    }

    if (state.isShuffle) {
      state.currentIndex = Math.floor(Math.random() * state.items.length);
      state.isPlaying = true;
      save();
      return state.items[state.currentIndex];
    }

    if (state.currentIndex < state.items.length - 1) {
      state.currentIndex++;
      state.isPlaying = true;
      save();
      return state.items[state.currentIndex];
    } else if (state.repeatMode === 'all' && state.items.length > 0) {
      state.currentIndex = 0;
      state.isPlaying = true;
      save();
      return state.items[state.currentIndex];
    }
    return null;
  },

  previous() {
    if (state.currentIndex > 0) {
      state.currentIndex--;
      state.isPlaying = true;
      save();
      return state.items[state.currentIndex];
    } else if (state.repeatMode === 'all' && state.items.length > 0) {
      state.currentIndex = state.items.length - 1;
      state.isPlaying = true;
      save();
      return state.items[state.currentIndex];
    }
    return null;
  },

  jumpTo(index: number) {
    if (index >= 0 && index < state.items.length) {
      state.currentIndex = index;
      state.isPlaying = true;
      save();
      return state.items[state.currentIndex];
    }
    return null;
  },

  play() {
    state.isPlaying = true;
    save();
  },

  pause() {
    state.isPlaying = false;
    save();
  },

  togglePlay() {
    state.isPlaying = !state.isPlaying;
    save();
  },

  toggleShuffle() {
    state.isShuffle = !state.isShuffle;
    save();
  },

  toggleRepeat() {
    const modes: ('none' | 'all' | 'one')[] = ['none', 'all', 'one'];
    const current = modes.indexOf(state.repeatMode);
    state.repeatMode = modes[(current + 1) % modes.length];
    save();
  },

  clear() {
    state = { ...state, items: [], currentIndex: -1, isPlaying: false };
    save();
  }
};
