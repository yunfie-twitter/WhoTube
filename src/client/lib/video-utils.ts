import type { VideoItem } from './types';

/**
 * リスト内の動画から、現在の動画を除外し、重複を取り除いた一意なリストを返します。
 */
export function uniqueVideos(lists: VideoItem[][], currentId: string): VideoItem[] {
  const seen = new Set<string>([currentId]);
  return lists.flat().filter((video) => {
    if (!video.id || seen.has(video.id)) return false;
    // 動画IDが11文字でない、またはタイプがvideoでないものは除外
    if (video.id.length !== 11) return false;
    if (video.type && video.type !== 'video') return false;
    // チャンネル名がN/Aのものも念のため除外
    if (video.channelTitle === 'N/A') return false;
    seen.add(video.id);
    return true;
  });
}

/**
 * 検索やランキングのためのテキスト正規化を行います。
 */
export function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/\[[^\]]*\]|\([^)]*\)|【[^】]*】/g, ' ')
    .replace(/official|music video|mv|feat\.?|ft\.?/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/**
 * 動画タイトルと投稿者に基づき、関連性の高い順にソートします。
 */
export function rankVideos(videos: VideoItem[], title: string, author: string): VideoItem[] {
  const normalizedTitle = normalizeSearchText(title);
  const primaryTitle = normalizeSearchText(title.split(/[\/|-]/)[0] ?? title);
  const normalizedAuthor = normalizeSearchText(author);
  return [...videos].sort((a, b) => {
    const aText = normalizeSearchText(`${a.title} ${a.channelTitle ?? ''}`);
    const bText = normalizeSearchText(`${b.title} ${b.channelTitle ?? ''}`);
    const score = (text: string) => {
      let value = 0;
      if (primaryTitle && text.includes(primaryTitle)) value += 8;
      if (normalizedTitle && text.includes(normalizedTitle)) value += 6;
      if (normalizedAuthor && text.includes(normalizedAuthor)) value += 5;
      if (text.includes('cover') || text.includes('歌ってみた')) value -= 2;
      return value;
    };
    return score(bText) - score(aText);
  });
}
