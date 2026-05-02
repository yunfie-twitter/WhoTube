import type {
  CaptionTrack,
  ChannelSummary,
  ManifestPayload,
  Subscription,
  TranscriptSegment,
  VideoItem
} from './types';
import { proxyImageUrl } from './images';

export async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export interface AppConfig {
  forcedSubscriptionChannelIds: string[];
}

export interface HomeShelf {
  title: string;
  items: VideoItem[];
}

export interface HomeFeedResponse {
  header?: { title: string };
  shelves: HomeShelf[];
  continuation?: string;
}

export async function getAppConfig(): Promise<AppConfig> {
  return apiFetch<AppConfig>('/api/config');
}

export async function getHomeFeed(continuation?: string): Promise<HomeFeedResponse> {
  const query = continuation ? `?continuation=${encodeURIComponent(continuation)}` : '';
  return apiFetch<HomeFeedResponse>(`/api/home/feed${query}`);
}

export async function getMusicHomeFeed(continuation?: string): Promise<HomeFeedResponse> {
  const query = continuation ? `?continuation=${encodeURIComponent(continuation)}` : '';
  return apiFetch<HomeFeedResponse>(`/api/home/music/feed${query}`);
}

function pickHighResThumbnail(thumbnails: any[]): string | undefined {
  if (!Array.isArray(thumbnails) || thumbnails.length === 0) return undefined;
  return proxyImageUrl([...thumbnails].sort((a, b) => (b.width || 0) - (a.width || 0))[0]?.url);
}

function toVideoItem(raw: any): VideoItem {
  const authorThumbnail =
    pickHighResThumbnail(raw.author?.thumbnails) ??
    pickHighResThumbnail(raw.author?.thumbnail) ??
    pickHighResThumbnail(raw.channel?.thumbnails) ??
    pickHighResThumbnail(raw.channel?.thumbnail) ??
    proxyImageUrl(raw.authorThumbnail) ??
    proxyImageUrl(raw.channelThumbnail) ??
    proxyImageUrl(raw.author?.thumbnail?.url) ??
    proxyImageUrl(raw.channel?.thumbnail?.url);

  return {
    id: String(raw.id ?? raw.videoId ?? ''),
    title: String(raw.title?.text ?? raw.title ?? 'Untitled'),
    channelId: raw.author?.id ?? raw.authorId ?? raw.channelId ?? raw.channel?.id ?? raw.artistId,
    channelTitle: raw.author?.name ?? raw.author ?? raw.channelTitle ?? raw.channel?.name ?? raw.artist,
    channelThumbnail: authorThumbnail,
    thumbnail:
      pickHighResThumbnail(raw.thumbnails) ??
      pickHighResThumbnail(raw.thumbnail) ??
      proxyImageUrl(Array.isArray(raw.thumbnail) ? raw.thumbnail[0]?.url : raw.thumbnail) ??
      proxyImageUrl(raw.author?.thumbnails?.[0]?.url),
    durationText: raw.duration?.text ?? raw.lengthText ?? raw.durationText ?? raw.duration,
    viewCountText: raw.view_count?.text ?? raw.viewCountText ?? raw.viewCount ?? raw.viewCountText ?? raw.subscriberCount ?? raw.videoCount,
    publishedText: raw.published?.text ?? raw.publishedText ?? raw.published ?? raw.published_time ?? raw.year,
    description: textValue(raw.description)
      ?? textValue(raw.shortDescription)
      ?? textValue(raw.short_description)
      ?? textValue(raw.snippet)
      ?? textValue(raw.accessibility?.label),
    isShort: Boolean(raw.isShort || raw.is_short || (raw.durationText && raw.durationText.split(':').length === 2 && parseInt(raw.durationText.split(':')[0]) === 0 && parseInt(raw.durationText.split(':')[1]) < 61)),
    type: raw.type
  };
}

function pickVideoList(payload: any): VideoItem[] {
  const maybeArrays = [
    payload?.videos,
    payload?.items,
    payload?.results,
    payload?.contents,
    payload?.data
  ];
  const list = maybeArrays.find((entry) => Array.isArray(entry)) ?? [];
  return list.map(toVideoItem).filter((v) => v.id && v.type !== 'channel' && v.type !== 'Channel');
}

function flattenRelatedSections(payload: any): any[] {
  if (Array.isArray(payload?.sections)) {
    return payload.sections.flatMap((section: any) => (Array.isArray(section?.items) ? section.items : []));
  }
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
}

function textValue(value: any): string | undefined {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (typeof value?.text === 'string') return value.text;
  if (typeof value?.simpleText === 'string') return value.simpleText;
  if (Array.isArray(value?.runs)) return value.runs.map((run: any) => run.text ?? '').join('');
  return undefined;
}

function pickVideoDescription(detail: any): string | undefined {
  return textValue(detail?.description)
    ?? textValue(detail?.shortDescription)
    ?? textValue(detail?.secondary_info?.description)
    ?? textValue(detail?.basic_info?.short_description)
    ?? textValue(detail?.microformat?.playerMicroformatRenderer?.description);
}

export async function getTrending(limit = 24, offset = 0, region?: string): Promise<{ items: VideoItem[]; nextOffset: number }> {
  const query = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (region) query.set('region', region);
  const data = await apiFetch<any>(`/api/trending?${query.toString()}`);
  const items = pickVideoList(data);
  return {
    items,
    nextOffset: offset + items.length
  };
}

export async function getPopular(limit = 24, offset = 0, region?: string): Promise<{ items: VideoItem[]; nextOffset: number }> {
  const query = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (region) query.set('region', region);
  const data = await apiFetch<any>(`/api/popular?${query.toString()}`);
  const items = pickVideoList(data);
  return {
    items,
    nextOffset: offset + items.length
  };
}

export interface SearchFilters {
  sort?: string;
  period?: string;
  duration?: string;
  features?: string[];
  type?: string;
  continuation?: string;
}

export async function searchVideos(q: string, filters?: SearchFilters): Promise<{ items: VideoItem[]; continuation?: string }> {
  const query = new URLSearchParams({ q });
  if (filters) {
    if (filters.sort) query.set('sort', filters.sort);
    if (filters.period) query.set('period', filters.period);
    if (filters.duration) query.set('duration', filters.duration);
    if (filters.type) query.set('type', filters.type);
    if (filters.continuation) query.set('continuation', filters.continuation);
    if (filters.features?.length) query.set('features', filters.features.join(','));
  }
  const data = await apiFetch<any>(`/api/search/videos?${query.toString()}`);
  return {
    items: pickVideoList(data),
    continuation: data.continuation
  };
}

export async function searchTracks(q: string): Promise<VideoItem[]> {
  const query = new URLSearchParams({ q });
  const data = await apiFetch<any>(`/api/search?${query.toString()}`);
  return Array.isArray(data.items) ? data.items.map((item: any) => ({
    id: item.id,
    title: item.title,
    channelId: item.artistId,
    channelTitle: item.artist,
    thumbnail: item.thumbnail,
    durationText: item.duration,
    viewCountText: item.viewCountText || '',
    publishedText: item.publishedText || '',
    type: 'video'
  })) : [];
}

export async function getCoverArt(title: string, artist: string): Promise<string | null> {
  try {
    const term = `${title} ${artist}`.trim();
    const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=song&limit=1`);
    if (!res.ok) return null;
    const data = await res.json();
    const result = data.results?.[0];
    if (result?.artworkUrl100) {
      return result.artworkUrl100.replace('100x100', '1000x1000');
    }
    return null;
  } catch (e) {
    console.warn('[iTunes API] Failed to fetch cover art:', e);
    return null;
  }
}

export async function getPlaylist(id: string): Promise<{ title: string; videos: VideoItem[] }> {
  const [playlist, videos] = await Promise.all([
    apiFetch<any>(`/api/playlist/${id}`),
    apiFetch<any>(`/api/playlist/${id}/videos?limit=100&offset=0`)
  ]);
  return {
    title: String(playlist?.title ?? playlist?.header?.title ?? `Playlist ${id}`),
    videos: pickVideoList(videos)
  };
}

export async function getVideo(id: string): Promise<{ detail: any; recommended: VideoItem[] }> {
  const rawDetail = await apiFetch<any>(`/api/video/${id}`);
  const detail = {
    ...rawDetail,
    normalizedDescription: pickVideoDescription(rawDetail)
  };
  const recommended = pickVideoList(
    detail?.recommended
      ? { videos: detail.recommended }
      : detail?.recommendations
        ? { videos: detail.recommendations }
        : detail
  );
  return { detail, recommended };
}

export async function getRelatedVideos(id: string): Promise<VideoItem[]> {
  const data = await apiFetch<any>(`/api/related/${id}`);
  return flattenRelatedSections(data)
    .map(toVideoItem)
    .filter((video) => /^[a-zA-Z0-9_-]{11}$/.test(video.id));
}

export async function getChannel(id: string): Promise<{ channel: ChannelSummary; videos: VideoItem[]; sections?: any[] }> {
  const data = await apiFetch<any>(`/api/channel/${id}`);
  const channel: ChannelSummary = {
    id,
    title: String(data?.name ?? data?.title ?? 'Channel'),
    description: data?.description,
    thumbnail: proxyImageUrl(data?.thumbnail),
    banner: proxyImageUrl(data?.banner),
    subscriberCount: data?.subscriberCount,
    handle: data?.handle,
    videoCount: data?.videoCount,
    viewCount: data?.viewCount,
    joinedDate: data?.joinedDate,
    country: data?.country,
    links: Array.isArray(data?.links) ? data.links : []
  };
  return { 
    channel, 
    videos: pickVideoList(data),
    sections: data.sections
  };
}

export interface ChannelTabResponse {
  items: VideoItem[];
  continuation?: string;
}

export async function getChannelVideos(id: string, continuation?: string): Promise<ChannelTabResponse> {
  const query = continuation ? `?continuation=${encodeURIComponent(continuation)}` : '';
  const data = await apiFetch<any>(`/api/channel/${encodeURIComponent(id)}/videos${query}`);
  return {
    items: pickVideoList(data),
    continuation: data.continuation
  };
}

export async function getChannelShorts(id: string, continuation?: string): Promise<ChannelTabResponse> {
  const query = continuation ? `?continuation=${encodeURIComponent(continuation)}` : '';
  const data = await apiFetch<any>(`/api/channel/${encodeURIComponent(id)}/shorts${query}`);
  return {
    items: pickVideoList(data),
    continuation: data.continuation
  };
}

export async function getChannelLive(id: string, continuation?: string): Promise<ChannelTabResponse> {
  const query = continuation ? `?continuation=${encodeURIComponent(continuation)}` : '';
  const data = await apiFetch<any>(`/api/channel/${encodeURIComponent(id)}/live${query}`);
  return {
    items: pickVideoList(data),
    continuation: data.continuation
  };
}

export async function getComments(id: string, sort: 'top' | 'newest' = 'top'): Promise<any[]> {
  const payload = await getCommentsPayload(id, sort);
  return payload.comments;
}

export async function getCommentsPayload(id: string, sort: 'top' | 'newest' = 'top', continuation?: string): Promise<{ count: string; comments: any[]; continuation?: string }> {
  const sortParam = sort === 'newest' ? 'NEWEST_FIRST' : 'TOP_COMMENTS';
  const query = new URLSearchParams({ sort: sortParam });
  if (continuation) query.set('continuation', continuation);
  const data = await apiFetch<any>(`/api/comments/${id}?${query.toString()}`);
  const list = data?.comments ?? data?.items ?? data?.results ?? [];
  return {
    count: String(data?.count ?? ''),
    comments: Array.isArray(list) ? list : [],
    continuation: data?.continuation
  };
}

export async function getCommentReplies(id: string, commentId: string): Promise<any[]> {
  const data = await apiFetch<any>(`/api/comments/${id}/replies/${encodeURIComponent(commentId)}`);
  const list = data?.comments ?? data?.items ?? data?.results ?? [];
  return Array.isArray(list) ? list : [];
}

export async function getManifest(id: string): Promise<ManifestPayload> {
  return apiFetch<ManifestPayload>(`/api/manifest/${id}`);
}

export async function getCaptions(id: string): Promise<CaptionTrack[]> {
  const data = await apiFetch<any>(`/api/captions/${id}`);
  const tracks = data?.tracks ?? data?.captions ?? [];
  return Array.isArray(tracks)
    ? tracks.map((x) => ({
        languageCode: String(x.languageCode ?? x.lang ?? ''),
        name: x.name?.text ?? x.name,
        isAutoGenerated: Boolean(x.isAutoGenerated)
      }))
    : [];
}

export async function getTranscript(id: string, lang?: string): Promise<TranscriptSegment[]> {
  const query = lang ? `?lang=${encodeURIComponent(lang)}` : '';
  const data = await apiFetch<any>(`/api/transcript/${id}${query}`);
  const list = data?.segments ?? data?.transcript ?? data?.items ?? [];
  return Array.isArray(list)
    ? list.map((x) => ({
        text: String(x.text ?? ''),
        startMs: Number(x.startMs ?? x.start ?? 0),
        durationMs: Number(x.durationMs ?? x.duration ?? 0)
      }))
    : [];
}

export async function getSubscriptionFeed(userId: string, limit = 50, offset = 0): Promise<VideoItem[]> {
  const query = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  const data = await apiFetch<any>(`/api/user/${userId}/feed?${query.toString()}`);
  return pickVideoList(data);
}

export async function getChannelFeed(channelId: string, limit = 5): Promise<VideoItem[]> {
  const data = await apiFetch<any>(`/api/feed/channel/${encodeURIComponent(channelId)}?limit=${limit}`);
  return pickVideoList(data);
}

export async function listServerSubscriptions(userId: string): Promise<Subscription[]> {
  const data = await apiFetch<any>(`/api/user/${userId}/subscriptions`);
  const list = data?.subscriptions ?? data?.items ?? [];
  return Array.isArray(list) ? list : [];
}

export async function serverBatchSubscribe(
  userId: string,
  items: { channelId: string; title?: string; handle?: string; thumbnail?: string }[]
): Promise<void> {
  const res = await fetch(`/api/user/${userId}/subscriptions/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items })
  });
  if (!res.ok) throw new Error('Batch subscribe failed');
}

export async function serverSubscribe(
  userId: string,
  payload: { channelId: string; title?: string; handle?: string; thumbnail?: string }
): Promise<void> {
  const res = await fetch(`/api/user/${userId}/subscriptions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('Subscribe failed');
}

export async function serverUnsubscribe(userId: string, channelId: string): Promise<void> {
  const res = await fetch(`/api/user/${userId}/subscriptions/${channelId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Unsubscribe failed');
}

export interface TimedLyricLine {
  time: number;
  text: string;
}

export interface LyricsPayload {
  kind: 'timed' | 'plain' | 'none';
  source: 'lrclib' | 'youtube' | 'generated' | 'none';
  isEstimated: boolean;
  lines: TimedLyricLine[];
  plainText: string | null;
}

export async function getLyrics(id: string): Promise<LyricsPayload> {
  return apiFetch<LyricsPayload>(`/api/lyrics/${id}`);
}

export async function getLocalSubscriptionFeed(channelIds: string[], limit = 50, offset = 0): Promise<VideoItem[]> {
  const res = await fetch('/api/user/subscription-feed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channelIds, limit, offset })
  });
  if (!res.ok) throw new Error('Subscription feed failed');
  return pickVideoList(await res.json());
}

export async function approveIndieAuth(payload: {
  me: string;
  client_id: string;
  redirect_uri: string;
  state?: string;
  scope?: string;
  code_challenge?: string;
  code_challenge_method?: string;
}): Promise<{ code: string; state?: string }> {
  const res = await fetch('/api/auth/approve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || 'IndieAuth approval failed');
  }
  return res.json();
}

export async function getHashtag(tag: string, continuation?: string): Promise<SearchVideosPayload & { title: string }> {
  const query = continuation ? `?continuation=${encodeURIComponent(continuation)}` : '';
  return apiFetch<SearchVideosPayload & { title: string }>(`/api/hashtag/${encodeURIComponent(tag)}${query}`);
}
