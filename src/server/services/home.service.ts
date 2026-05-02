import { getYouTube } from '../lib/youtube.js';
import { HomeFeedPayload, HomeShelf } from '../lib/types.js';
import { YouTubeService } from './youtube.service.js';
import { stringifyText } from '../lib/youtube.utils.js';

export class HomeService {
  static async getHomeFeed(continuation?: string): Promise<HomeFeedPayload> {
    const yt = await getYouTube('WEB');
    let homeFeed: any;

    if (continuation) {
      homeFeed = await (yt as any).getContinuation({ continuation } as any);
    } else {
      homeFeed = await yt.getHomeFeed();
    }

    const shelves: HomeShelf[] = (homeFeed.contents?.shelves || homeFeed.shelves || [])
      .map((shelf: any) => {
        const title = stringifyText(shelf.title) || stringifyText(shelf.header?.title) || '';
        const items = (shelf.contents || shelf.items || [])
          .map((item: any) => YouTubeService.normalizeVideoItem(item))
          .filter(Boolean);
        
        if (items.length === 0) return null;
        return { title, items };
      })
      .filter(Boolean);

    // If there are no shelves but there are videos in a single list
    if (shelves.length === 0 && homeFeed.videos) {
        const items = homeFeed.videos
            .map((v: any) => YouTubeService.normalizeVideoItem(v))
            .filter(Boolean);
        if (items.length > 0) {
            shelves.push({ title: 'Recommended', items });
        }
    }

    return {
      header: homeFeed.header ? {
        title: stringifyText(homeFeed.header.title)
      } : undefined,
      shelves,
      continuation: homeFeed.continuation || homeFeed.continuation_token
    };
  }

  static async getMusicHomeFeed(continuation?: string): Promise<HomeFeedPayload> {
    const yt = await getYouTube('WEB_REMIX');
    let homeFeed: any;

    if (continuation) {
      homeFeed = await (yt as any).getContinuation({ continuation } as any);
    } else {
      homeFeed = await yt.music.getHomeFeed();
    }

    const shelves: HomeShelf[] = (homeFeed.contents?.shelves || homeFeed.shelves || homeFeed.sections || [])
      .map((shelf: any) => {
        const title = stringifyText(shelf.title) || stringifyText(shelf.header?.title) || '';
        const items = (shelf.contents || shelf.items || [])
          .map((item: any) => YouTubeService.normalizeVideoItem(item))
          .filter(Boolean);
        
        if (items.length === 0) return null;
        return { title, items };
      })
      .filter(Boolean);

    return {
      shelves,
      continuation: homeFeed.continuation || homeFeed.continuation_token
    };
  }
}
