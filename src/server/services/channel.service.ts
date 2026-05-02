import { getYouTube } from '../lib/youtube.js';
import { ChannelDetailsPayload, ChannelFeedPayload, FeedEntry, YouTubeClientType, PlaylistVideosPayload, ChannelSection, VideoSummary } from '../lib/types.js';
import { YouTubeService } from './youtube.service.js';
import { stringifyText, enforceCacheLimit, upgradeThumbnail } from '../lib/youtube.utils.js';
import type { YT } from 'youtubei.js';

const channelDetailsCache = new Map<string, { data: ChannelDetailsPayload, timestamp: number }>();
const channelFeedCache = new Map<string, { data: ChannelFeedPayload, timestamp: number }>();
const userFeedCache = new Map<string, { data: FeedEntry[], timestamp: number }>();

export class ChannelService {
  private static CACHE_TTL_CHANNEL_DETAILS = 60 * 60 * 1000;
  private static CACHE_TTL_CHANNEL_RSS = 30 * 60 * 1000;
  private static CACHE_TTL_USER_FEED = 15 * 60 * 1000;

  static async getChannelDetails(channelId: string): Promise<ChannelDetailsPayload> {
    const cached = channelDetailsCache.get(channelId);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_CHANNEL_DETAILS) {
      return cached.data;
    }

    try {
      const yt = await getYouTube('WEB');
      const channel = await yt.getChannel(channelId) as YT.Channel;

      // Extract metadata from the Channel object
      const name = channel.metadata.title || 'Channel';
      const handle = (channel.header as any)?.author?.handle?.text || (channel.header as any)?.content?.channel_handle?.text || '';
      const description = channel.metadata.description || '';
      const thumbnail = upgradeThumbnail(channel.metadata.thumbnail?.at?.(-1)?.url || (channel.header as any)?.author?.thumbnails?.at?.(-1)?.url || (channel.metadata as any).avatar?.at?.(-1)?.url || '');
      const banner = (channel.header as any)?.banner?.thumbnails?.at?.(-1)?.url || '';
      const subscriberCount = stringifyText((channel.metadata as any).subscriber_count) || stringifyText((channel.header as any)?.author?.subscriber_count) || '';
      const videoCount = stringifyText((channel.metadata as any).video_count) || stringifyText((channel.header as any)?.author?.video_count) || '';

      // Get Home tab for sections
      let homeTab: YT.Channel | null = null;
      try {
        homeTab = channel.has_home ? await channel.getHome() : null;
      } catch (e) {
        console.warn(`[ChannelService] Failed to get Home tab for ${channelId}:`, e);
      }

      const sections: ChannelSection[] = [];
      if (homeTab) {
        const homeContent = (homeTab.current_tab?.content as any)?.contents || (homeTab as any).contents?.contents || [];
        if (Array.isArray(homeContent)) {
          homeContent.forEach((section: any) => {
            const shelf = section?.content || section;
            if (shelf?.type === 'Shelf' || shelf?.type === 'ReelShelf' || shelf?.type === 'MusicShelf') {
              const title = stringifyText(shelf.title);
              const items = YouTubeService.extractVideos(shelf.content || shelf.items || shelf);
              if (items.length > 0) {
                sections.push({
                  title,
                  items: items.map(v => ({
                    ...v,
                    author: (!v.author || v.author === 'Unknown' || v.author === 'N/A') ? name : v.author,
                    authorId: !v.authorId || v.authorId === 'N/A' ? channelId : v.authorId
                  })),
                  type: shelf.type === 'ReelShelf' ? 'shorts' : 'video'
                });
              }
            }
          });
        }
      }

      // Get Videos tab for initial video list
      let videosTab: YT.Channel | null = null;
      try {
        videosTab = channel.has_videos ? await channel.getVideos() : null;
      } catch (e) {
        console.warn(`[ChannelService] Failed to get Videos tab for ${channelId}:`, e);
      }

      const allRawVideos = videosTab ? YouTubeService.extractVideos(videosTab.current_tab?.content || (videosTab as any).contents || videosTab) : [];
      const mappedVideos = allRawVideos.map((video: any) => ({
        ...video,
        author: (!video.author || video.author === 'Unknown' || video.author === 'N/A') ? name : video.author,
        authorId: !video.authorId || video.authorId === 'N/A' ? channelId : video.authorId,
        authorUrl: video.authorUrl || (channel.header as any)?.author?.url || null
      }));

      const videos = mappedVideos.filter(v => !v.isShort && !v.isLive).slice(0, 40);
      const shorts = mappedVideos.filter(v => v.isShort).slice(0, 20);
      const live = mappedVideos.filter(v => v.isLive).slice(0, 10);

      // Get About for more metadata
      let about: any = null;
      try {
        about = channel.has_about ? await channel.getAbout() : null;
      } catch (e) {
        // ignore
      }
      
      const aboutMetadata = about?.metadata || about;
      const links = (aboutMetadata?.primary_links || aboutMetadata?.links || [])
        .map((link: any) => ({
          title: stringifyText(link?.title) || stringifyText(link?.text) || '',
          url: stringifyText(link?.link) || link?.endpoint?.metadata?.url || link?.endpoint?.payload?.url || ''
        }))
        .filter((link: { title: string; url: string }) => link.title && link.url);

      const isVerified = Boolean((channel.metadata as any).is_verified);
      const isVerifiedArtist = Boolean((channel as any).metadata?.is_verified_artist);

      const payload: ChannelDetailsPayload = {
        id: channelId,
        name,
        handle,
        description,
        thumbnail,
        banner,
        subscriberCount,
        videoCount,
        viewCount: stringifyText(aboutMetadata?.view_count) || '',
        joinedDate: stringifyText(aboutMetadata?.joined_date) || '',
        country: stringifyText(aboutMetadata?.country) || '',
        links,
        isVerified,
        isVerifiedArtist,
        videos,
        shorts,
        live,
        clips: [],
        sections
      };

      enforceCacheLimit(channelDetailsCache, 100);
      channelDetailsCache.set(channelId, { data: payload, timestamp: Date.now() });
      return payload;
    } catch (err) {
      console.error(`[ChannelService] getChannelDetails failed for ${channelId}:`, err);
      throw err;
    }
  }

  static async getChannelTab(channelId: string, tab: 'videos' | 'shorts' | 'live' | 'playlists', continuation?: string): Promise<PlaylistVideosPayload> {
    const yt = await getYouTube('WEB');
    
    let tabPage: any;
    if (continuation) {
      tabPage = await (yt as any).getContinuation({ continuation } as any);
    } else {
      const channel = await yt.getChannel(channelId) as YT.Channel;
      switch (tab) {
        case 'videos': tabPage = channel.has_videos ? await channel.getVideos() : null; break;
        case 'shorts': tabPage = channel.has_shorts ? await channel.getShorts() : null; break;
        case 'live': tabPage = channel.has_live_streams ? await channel.getLiveStreams() : null; break;
        case 'playlists': tabPage = channel.has_playlists ? await channel.getPlaylists() : null; break;
      }
    }

    if (!tabPage) {
      throw new Error(`Tab ${tab} not found for channel ${channelId}`);
    }

    const rawVideos = YouTubeService.extractVideos(tabPage.current_tab?.content || tabPage.contents || tabPage);
    const nextContinuation = tabPage.continuation || undefined;
    
    const title = tabPage.metadata?.title || 'Channel';

    return {
      id: `${channelId}:${tab}`,
      title: `${title} ${tab}`,
      description: '',
      thumbnail: '',
      author: title,
      authorId: channelId,
      totalItems: String(rawVideos.length),
      items: rawVideos.map((video: any) => ({
        ...video,
        author: (!video.author || video.author === 'Unknown' || video.author === 'N/A') ? title : video.author,
        authorId: !video.authorId || video.authorId === 'N/A' ? channelId : video.authorId
      })),
      offset: 0,
      limit: rawVideos.length,
      hasMore: !!nextContinuation,
      continuation: nextContinuation
    };
  }

  static async getChannelFeed(channelId: string, limit = 15): Promise<ChannelFeedPayload> {
    const safeLimit = Math.max(1, Math.min(limit, 50));
    const cacheKey = `${channelId}:${safeLimit}`;
    const cached = channelFeedCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_CHANNEL_RSS) {
      return {
        ...cached.data,
        entries: cached.data.entries.slice(0, safeLimit)
      };
    }

    const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
    try {
      const response = await fetch(rssUrl, { signal: AbortSignal.timeout(5000) });
      const xml = await response.text();
      const parsed = this.parseChannelFeedXml(channelId, xml);
      
      // RSS が空だったり失敗した場合のフォールバック
      if (parsed.entries.length === 0) {
        throw new Error('RSS feed empty');
      }

      const payload = {
        ...parsed,
        entries: parsed.entries.slice(0, safeLimit)
      };

      enforceCacheLimit(channelFeedCache, 200);
      channelFeedCache.set(cacheKey, { data: payload, timestamp: Date.now() });
      return payload;
    } catch (e) {
      console.warn(`[ChannelService] RSS fetch failed for ${channelId}, falling back to API:`, (e as any).message);
      try {
        const yt = await getYouTube('WEB');
        const channel = await yt.getChannel(channelId) as YT.Channel;
        const videosTab = channel.has_videos ? await channel.getVideos() : channel;
        const rawVideos = YouTubeService.extractVideos((videosTab as any)?.current_tab?.content || (videosTab as any)?.contents || videosTab);
        
        const entries: FeedEntry[] = rawVideos.map(v => ({
          id: v.id,
          videoId: v.id,
          title: v.title,
          author: (!v.author || v.author === 'Unknown' || v.author === 'N/A') ? ((videosTab as any)?.metadata?.title || 'Unknown') : v.author,
          authorId: channelId,
          channelId,
          channelTitle: (!v.author || v.author === 'Unknown' || v.author === 'N/A') ? ((videosTab as any)?.metadata?.title || 'Unknown') : v.author,
          thumbnail: v.thumbnail,
          published: v.published || '',
          updated: '',
          description: v.description || '',
          link: `https://www.youtube.com/watch?v=${v.id}`
        }));

        const payload: ChannelFeedPayload = {
          channelId,
          title: (videosTab as any)?.metadata?.title || 'Unknown',
          rssUrl,
          entries
        };

        enforceCacheLimit(channelFeedCache, 200);
        channelFeedCache.set(cacheKey, { data: payload, timestamp: Date.now() });
        return payload;
      } catch (err) {
        console.error('[ChannelService] API fallback failed:', err);
        return {
          channelId,
          title: 'Unknown',
          rssUrl,
          entries: []
        };
      }
    }
  }

  static async getChannelFeedXml(channelId: string): Promise<string> {
    const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
    const response = await fetch(rssUrl);
    return await response.text();
  }

  static async getSubscriptionFeed(channelIds: string[], limit = 50, offset = 0): Promise<FeedEntry[]> {
    const normalizedIds = [...new Set(channelIds.filter(Boolean))].sort();
    const safeLimit = Math.max(1, Math.min(limit, 100));
    const safeOffset = Math.max(0, offset);
    const cacheKey = `${normalizedIds.join(',')}:${safeLimit}:${safeOffset}`;
    const cached = userFeedCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_USER_FEED) {
      return cached.data;
    }

    const feeds = await Promise.all(normalizedIds.map((channelId) => this.getChannelFeed(channelId, 25).catch(() => null)));
    const entries = feeds
      .filter((feed): feed is ChannelFeedPayload => Boolean(feed))
      .flatMap((feed) => feed.entries)
      .sort((a, b) => Date.parse(b.published || b.updated || '1970-01-01') - Date.parse(a.published || a.updated || '1970-01-01'))
      .slice(safeOffset, safeOffset + safeLimit);

    enforceCacheLimit(userFeedCache, 50);
    userFeedCache.set(cacheKey, { data: entries, timestamp: Date.now() });
    return entries;
  }

  // --- Normalization Helpers ---

  private static getChannelMetadataRowText(row: any, index: number): string {
    return stringifyText(row?.metadata_parts?.[index]?.text);
  }

  private static parseChannelFeedXml(channelId: string, xml: string): ChannelFeedPayload {
    const titleMatch = xml.match(/<title>(.*?)<\/title>/);
    const authorMatch = xml.match(/<author>.*?<name>(.*?)<\/name>.*?<\/author>/s);
    
    const entryMatches = xml.matchAll(/<entry>.*?<videoId>(.*?)<\/videoId>.*?<title>(.*?)<\/title>.*?<published>(.*?)<\/published>.*?<updated>(.*?)<\/updated>.*?<thumbnail url="(.*?)"/gs);
    const entries: FeedEntry[] = [];
    
    for (const match of entryMatches) {
      const videoId = match[1];
      const authorNameRaw = authorMatch?.[1] || titleMatch?.[1] || 'Unknown';
      const authorName = (authorNameRaw === 'N/A' || !authorNameRaw) ? (titleMatch?.[1] || 'Unknown') : authorNameRaw;
      entries.push({
        id: videoId,
        videoId,
        title: match[2],
        author: authorName,
        authorId: channelId,
        channelId,
        channelTitle: authorName,
        thumbnail: match[5],
        published: match[3],
        updated: match[4],
        description: '',
        link: `https://www.youtube.com/watch?v=${videoId}`
      });
    }

    return {
      channelId,
      title: titleMatch?.[1] || 'Unknown',
      rssUrl: `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`,
      entries
    };
  }

  static buildSubscriptionFeedXml(title: string, feedUrl: string, entries: FeedEntry[]): string {
    const entryXml = entries.map(entry => `
    <entry>
      <id>yt:video:${entry.id}</id>
      <yt:videoId>${entry.id}</yt:videoId>
      <title>${stringifyText(entry.title)}</title>
      <link rel="alternate" href="https://www.youtube.com/watch?v=${entry.id}"/>
      <author>
        <name>${stringifyText(entry.author)}</name>
        <uri>https://www.youtube.com/channel/${entry.authorId}</uri>
      </author>
      <published>${entry.published}</published>
      <updated>${entry.updated}</updated>
      <media:group>
        <media:title>${stringifyText(entry.title)}</media:title>
        <media:thumbnail url="${entry.thumbnail}" width="480" height="360"/>
        <media:description></media:description>
      </media:group>
    </entry>`).join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom">
  <title>${title}</title>
  <link rel="self" href="${feedUrl}"/>
  <updated>${new Date().toISOString()}</updated>
  ${entryXml}
</feed>`;
  }

  static buildSubscriptionFeedXmlDocument(title: string, feedUrl: string, entries: FeedEntry[]): string {
    return this.buildSubscriptionFeedXml(title, feedUrl, entries);
  }
}
