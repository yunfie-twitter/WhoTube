/**
 * YouTube 関連の処理で使用する共通ユーティリティ
 */

/**
 * 特殊文字を XML エスケープする
 */
export function enforceCacheLimit(cache: Map<any, any>, limit = 500) {
  if (cache.size > limit) {
    const keys = Array.from(cache.keys()).slice(0, Math.floor(limit / 5));
    keys.forEach(k => cache.delete(k));
  }
}

export function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * 秒数を ISO 8601 期間形式 (PT...S) に変換する
 */
export function isoDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  let res = 'PT';
  if (h > 0) res += `${h}H`;
  if (m > 0) res += `${m}M`;
  res += `${s}S`;
  return res;
}

/**
 * 秒数を HH:MM:SS または MM:SS 形式に変換する
 */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * InnerTube のテキストオブジェクトを文字列に変換する
 */
export function stringifyText(value: any): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value?.text === 'string') return value.text;
  if (Array.isArray(value?.runs)) {
    return value.runs.map((run: any) => run?.text || '').join('').trim();
  }
  if (typeof value?.toString === 'function' && value.toString !== Object.prototype.toString) {
    const text = value.toString();
    return typeof text === 'string' ? text : '';
  }
  return '';
}

/**
 * サムネイル URL を高品質なものにアップグレードする
 */
export function upgradeThumbnail(url: string): string {
  if (!url || typeof url !== 'string') return '';

  let res = url;

  // googleusercontent.com / ggpht.com (アバター, チャンネルアートなど)
  if (res.includes('googleusercontent.com') || res.includes('ggpht.com')) {
    // =w...-h... 形式の置換
    if (res.includes('=w')) {
      res = res.replace(/=w\d+-h\d+.*$/, '=w1200-h1200-l90-rj');
    } 
    // =s... 形式の置換
    else if (res.includes('=s')) {
      res = res.replace(/=s\d+.*$/, '=s1200-c-k-c0x00ffffff-no-rj');
    }
    // パス形式 /s1200/ の置換
    res = res.replace(/\/s\d+(-c)?$/, '/s1200');
  }

  // i.ytimg.com (動画サムネイル)
  if (res.includes('i.ytimg.com')) {
    // すでに高品質な場合はそのまま返す
    if (res.includes('maxresdefault') || res.includes('hq720') || res.includes('sddefault')) {
      return res;
    }
    // 標準的なサムネイルを maxresdefault にアップグレード
    // .jpg と .webp の両方に対応し、クエリパラメータを保持する
    res = res.replace(/\/(default|mqdefault|hqdefault|sddefault|hq720)\.(jpg|webp)(\?.*)?$/, '/maxresdefault.$2$3');
  }

  return res;
}

/**
 * バイトレンジを正規化する
 */
export function normalizeByteRange(range: any): { start: number; end: number } | null {
  if (!range) return null;
  const start = Number(range.start);
  const end = Number(range.end);
  if (isNaN(start) || isNaN(end)) return null;
  return { start, end };
}

/**
 * HLS プレイリスト用のエスケープ
 */
export function hlsEscape(value: string): string {
  return value.replace(/"/g, '\\"');
}

/**
 * 画像 URL をプロキシ経由に変換します。
 */
export function proxyImageUrl(url: string | undefined | null): string {
  if (!url || typeof url !== 'string') return '';
  if (url.startsWith('/image.webp')) return url;
  // YouTube の画像サーバーの URL のみプロキシを通す（効率化）
  if (url.includes('ytimg.com') || url.includes('googleusercontent.com') || url.includes('youtube.com')) {
    return `/image.webp?url=${encodeURIComponent(url)}`;
  }
  return url;
}

/**
 * オブジェクト内の画像関連フィールドを再帰的にスキャンしてプロキシ化します。
 */
export function proxyAllImages<T>(obj: T): T {
  if (!obj || typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(item => proxyAllImages(item)) as any;
  }

  const result = { ...obj } as any;
  for (const key in result) {
    const value = result[key];
    if (typeof value === 'string' && (key.toLowerCase().includes('thumbnail') || key.toLowerCase().includes('avatar') || key.toLowerCase().includes('banner') || key.toLowerCase().includes('artwork') || key.toLowerCase().includes('picture'))) {
      result[key] = proxyImageUrl(value);
    } else if (typeof value === 'object') {
      result[key] = proxyAllImages(value);
    }
  }
  return result;
}

/**
 * 指定されたミリ秒間待機する
 */
export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * バイトレンジの長さを計算する
 */
export function rangeLength(range: { start: number; end: number }): number {
  return range.end - range.start + 1;
}

/**
 * iTunes からアートワークを取得する (YouTube のサムネイルが低い場合のフォールバック)
 */
export async function fetchItunesArtwork(title: string, artist: string): Promise<string | null> {
  try {
    const query = `${artist} ${title}`;
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&limit=1`;
    const res = await fetch(url);
    const data = await res.json();
    const result = data.results?.[0];
    if (result && result.artworkUrl100) {
      return result.artworkUrl100.replace('100x100bb', '1200x1200bb');
    }
  } catch { }
  return null;
}

/**
 * 基本情報からメタデータを生成する
 */
export async function metadataFromBasicInfo(videoId: string, basic: any): Promise<any> {
  const title = basic?.title || '';
  const artist = basic?.author || basic?.channel?.name || '';
  const artistId = basic?.channel_id || basic?.author?.id || basic?.channel?.id;
  
  // iTunes 検索を並列で行う
  const itunesPromise = fetchItunesArtwork(title, artist);
  
  const ytThumbnail = upgradeThumbnail(basic?.thumbnail?.at?.(-1)?.url || basic?.thumbnail?.[0]?.url || '');
  const durationSeconds = basic?.duration || 0;
  const durationText = formatDuration(durationSeconds);

  const itunes = await itunesPromise;
  const isMV = title.toLowerCase().includes('mv') || title.toLowerCase().includes('music video') || title.toLowerCase().includes('official video');
  
  return {
    id: videoId,
    title,
    artist,
    artistId: artistId || null,
    thumbnail: (itunes && !isMV) ? itunes : (ytThumbnail || itunes),
    duration: durationText
  };
}

/**
 * 歌詞検索用のクリーンアップ
 */
export function cleanTrackText(text: string): string {
  if (!text) return '';
  return text
    .replace(/\(feat\..*?\)/gi, '')
    .replace(/\[feat\..*?\]/gi, '')
    .replace(/\(with.*?\)/gi, '')
    .replace(/\[with.*?\]/gi, '')
    .replace(/- Official.*$/gi, '')
    .replace(/\(Official.*$/gi, '')
    .replace(/\[Official.*$/gi, '')
    .replace(/\(Lyric.*$/gi, '')
    .replace(/\[Lyric.*$/gi, '')
    .replace(/\(Music Video.*$/gi, '')
    .replace(/\[Music Video.*$/gi, '')
    .replace(/\(Video.*$/gi, '')
    .replace(/\[Video.*$/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * MM:SS 形式を秒数に変換する
 */
export function parseDurationSeconds(duration: string | undefined | null): number {
  if (!duration) return 0;
  const parts = duration.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return isNaN(parts[0]) ? 0 : parts[0];
}

/**
 * 歌詞の候補をスコアリングする
 */
export function scoreLyricsCandidate(candidate: any, expected: { title: string; artist: string; durationSec?: number }): number {
  if (!candidate) return 0;
  const titleScore = compareStrings(cleanTrackText(candidate.trackName || candidate.title || ''), expected.title);
  const artistScore = compareStrings(cleanTrackText(candidate.artistName || candidate.artist || ''), expected.artist);
  
  let durationScore = 1.0;
  if (expected.durationSec && candidate.duration) {
    const diff = Math.abs(candidate.duration - expected.durationSec);
    if (diff > 10) durationScore = 0.5;
    if (diff > 20) durationScore = 0.2;
    if (diff > 30) durationScore = 0;
  }
  
  return (titleScore * 0.5 + artistScore * 0.4 + durationScore * 0.1);
}

function compareStrings(a: string, b: string): number {
  const s1 = a.toLowerCase();
  const s2 = b.toLowerCase();
  if (s1 === s2) return 1.0;
  if (s1.includes(s2) || s2.includes(s1)) return 0.8;
  return 0;
}

/**
 * 最もスコアの高い歌詞候補を選択する
 */
export function pickBestLyricsCandidate(results: any[], expected: { title: string; artist: string; durationSec?: number }, mustHaveSynced = false): { candidate: any; score: number } | null {
  if (!Array.isArray(results) || results.length === 0) return null;
  
  let best = null;
  let maxScore = -1;
  
  for (const res of results) {
    if (mustHaveSynced && !res.syncedLyrics) continue;
    const score = scoreLyricsCandidate(res, expected);
    if (score > maxScore) {
      maxScore = score;
      best = res;
    }
  }
  
  return best ? { candidate: best, score: maxScore } : null;
}

/**
 * 歌詞ペイロードを構築する
 */
export function buildLyricsPayload(params: {
  source: string;
  syncedLyrics?: string | null;
  plainLyrics?: string | null;
  durationSec?: number;
  allowEstimate?: boolean;
}): any {
  const { source, syncedLyrics, plainLyrics, durationSec } = params;
  
  if (syncedLyrics) {
    const lines = syncedLyrics.split('\n').map(line => {
      const match = line.match(/^\[(\d+):(\d+\.\d+)\](.*)$/);
      if (match) {
        const min = parseInt(match[1]);
        const sec = parseFloat(match[2]);
        const time = min * 60 + sec;
        return { time, text: match[3].trim() };
      }
      return null;
    }).filter(Boolean);
    
    if (lines.length > 0) {
      return { kind: 'timed', source, lines };
    }
  }
  
  if (plainLyrics) {
    const lines = plainLyrics.split('\n').map(text => ({ text: text.trim() })).filter(l => l.text);
    return { kind: 'plain', source, lines };
  }
  
  return { kind: 'none', source, message: 'No lyrics available' };
}

/**
 * 配列をランダムにシャッフルする
 * @param array シャッフルする配列
 * @param seed シード値（指定すると再現性のあるシャッフルになる）
 */
export function shuffleArray<T>(array: T[], seed?: number): T[] {
  const result = [...array];
  let currentSeed = seed !== undefined ? seed : 0;
  
  const random = () => {
    if (seed !== undefined) {
      // シンプルな LCG (Linear Congruential Generator)
      currentSeed = (currentSeed * 9301 + 49297) % 233280;
      return currentSeed / 233280;
    }
    return Math.random();
  };

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
