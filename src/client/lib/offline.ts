import shaka from 'shaka-player/dist/shaka-player.ui';

export interface OfflineVideoMetadata {
  id: string;
  title: string;
  author: string;
  thumbnail: string;
  durationText?: string;
  blob?: Blob; // 動画データ本体
  offlineUri?: string; // Shaka互換用（将来的な拡張のため）
  addedAt: number;
  size?: number;
}

const DB_NAME = 'whotube-offline-db';
const DB_VERSION = 1;
const STORE_NAME = 'metadata';

class OfflineManager {
  private storage: shaka.offline.Storage | null = null;
  private isInitializing = false;

  async init() {
    if (this.storage) return;
    if (this.isInitializing) {
      while (this.isInitializing) {
        await new Promise(r => setTimeout(r, 100));
      }
      return;
    }

    this.isInitializing = true;
    try {
      shaka.polyfill.installAll();
      if (!shaka.offline.Storage.support()) {
        throw new Error('お使いのブラウザはオフライン保存に対応していません。');
      }
      this.storage = new shaka.offline.Storage();
      
      // デフォルト設定
      this.storage.configure({
        offline: {
          trackSelectionCallback: (tracks: shaka.extern.Track[]) => {
            // 最も画質が良いビデオとオーディオを選択 (または 720p 程度に制限することも可能)
            const videoTracks = tracks.filter(t => t.type === 'video').sort((a, b) => (b.height || 0) - (a.height || 0));
            const audioTracks = tracks.filter(t => t.type === 'audio').sort((a, b) => (b.bandwidth || 0) - (a.bandwidth || 0));
            
            const selected = [];
            if (videoTracks.length > 0) {
                // 1080p以下で一番いいやつを選ぶ（容量節約のため）
                const bestVideo = videoTracks.find(t => (t.height || 0) <= 1080) || videoTracks[0];
                selected.push(bestVideo);
            }
            if (audioTracks.length > 0) selected.push(audioTracks[0]);
            
            return selected;
          }
        }
      });
    } finally {
      this.isInitializing = false;
    }
  }

  private async getDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async saveMetadata(metadata: OfflineVideoMetadata) {
    const db = await this.getDB();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(metadata);
      request.oncomplete = () => resolve();
      request.onerror = () => reject(request.error);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getVideos(): Promise<OfflineVideoMetadata[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async getVideo(id: string): Promise<OfflineVideoMetadata | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteVideo(id: string) {
    const db = await this.getDB();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async downloadVideo(
    id: string, 
    _unused_manifestUrl: string, 
    metadata: Omit<OfflineVideoMetadata, 'offlineUri' | 'addedAt' | 'blob'>, 
    onProgress?: (progress: number) => void
  ) {
    try {
      // 最高の状態でマージされたMP4プロキシを取得
      const videoUrl = `/api/proxy/video/${id}`;
      
      const response = await fetch(videoUrl);
      if (!response.ok) throw new Error(`ダウンロードに失敗しました: ${response.statusText}`);
      
      const contentLength = Number(response.headers.get('content-length')) || 0;
      const reader = response.body?.getReader();
      if (!reader) throw new Error('レスポンスボディを読み取れません。');

      let receivedLength = 0;
      const chunks: Uint8Array[] = [];

      while(true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        receivedLength += value.length;
        if (contentLength > 0) {
          onProgress?.((receivedLength / contentLength) * 100);
        }
      }

      const blob = new Blob(chunks, { type: 'video/mp4' });
      const fullMetadata: OfflineVideoMetadata = {
        ...metadata,
        blob,
        addedAt: Date.now(),
        size: blob.size
      };
      
      await this.saveMetadata(fullMetadata);
      return fullMetadata;
    } catch (e) {
      console.error('[Offline] Download failed:', e);
      throw e;
    }
  }

  async isVideoDownloaded(id: string): Promise<boolean> {
    const video = await this.getVideo(id);
    return !!video;
  }
}

export const offlineManager = new OfflineManager();
