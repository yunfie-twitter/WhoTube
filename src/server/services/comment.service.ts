import { getYouTube } from '../lib/youtube.js';
import { CommentsPayload, CommentSummary } from '../lib/types.js';
import { stringifyText, enforceCacheLimit, upgradeThumbnail } from '../lib/youtube.utils.js';

const commentsCache = new Map<string, { data: CommentsPayload, timestamp: number }>();

export class CommentService {
  private static CACHE_TTL_COMMENTS = 10 * 60 * 1000;

  static async getComments(videoId: string, sort: 'TOP_COMMENTS' | 'NEWEST_FIRST' = 'TOP_COMMENTS', continuation?: string): Promise<CommentsPayload> {
    const cacheKey = continuation ? `${videoId}:${sort}:cont:${continuation}` : `${videoId}:${sort}`;
    const cached = commentsCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_COMMENTS) {
      return cached.data;
    }

    try {
      const yt = await getYouTube('WEB');
      let comments: any;

      if (continuation) {
        comments = await (yt as any).getContinuation({ continuation } as any);
      } else {
        comments = await yt.getComments(videoId, sort);
      }
      
      const commentItems = (Array.isArray(comments?.contents) ? comments.contents : [])
        .map((item: any) => {
          const comment = item?.comment || item;
          return this.normalizeComment(comment);
        })
        .filter((item: CommentSummary | null): item is CommentSummary => Boolean(item));

      const payload: CommentsPayload = {
        videoId,
        count: stringifyText(comments?.header?.count) || stringifyText(comments?.header?.comments_count) || String(commentItems.length),
        sort,
        comments: commentItems,
        continuation: comments.continuation || null
      };

      enforceCacheLimit(commentsCache, 100);
      commentsCache.set(cacheKey, { data: payload, timestamp: Date.now() });
      return payload;
    } catch (e) {
      console.error('[CommentService] getComments failed:', e);
      throw e;
    }
  }

  static async getCommentReplies(videoId: string, commentId: string): Promise<CommentsPayload> {
    const cacheKey = `${videoId}:replies:${commentId}`;
    const cached = commentsCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_COMMENTS) {
      return cached.data;
    }

    try {
      const yt = await getYouTube('WEB');
      const comments = await yt.getComments(videoId, 'TOP_COMMENTS', commentId);
      
      const replyItems = (Array.isArray(comments?.contents) ? comments.contents : [])
        .map((item: any) => {
          const comment = item?.comment || item;
          return this.normalizeComment(comment);
        })
        .filter((item: CommentSummary | null): item is CommentSummary => Boolean(item));

      const payload: CommentsPayload = {
        videoId,
        count: stringifyText(comments?.header?.count) || String(replyItems.length),
        sort: 'TOP_COMMENTS',
        comments: replyItems,
        continuation: this.extractContinuationToken(comments)
      };

      enforceCacheLimit(commentsCache, 100);
      commentsCache.set(cacheKey, { data: payload, timestamp: Date.now() });
      return payload;
    } catch (e) {
      console.error('[CommentService] getCommentReplies failed:', e);
      throw e;
    }
  }

  private static normalizeComment(item: any): CommentSummary | null {
    const id = item?.comment_id || item?.id;
    if (!id) return null;

    return {
      id,
      author: item?.author?.name || 'Unknown',
      authorId: item?.author?.id || null,
      authorUrl: item?.author?.url || null,
      authorThumbnail: upgradeThumbnail(item?.author?.thumbnails?.at?.(-1)?.url || ''),
      content: stringifyText(item?.content),
      published: item?.published || item?.published_time?.text || '',
      likeCount: String(item?.like_count || item?.vote_count || 0),
      replyCount: String(item?.reply_count || item?.replies_count || 0),
      isHearted: Boolean(item?.is_hearted || item?.creator_heart),
      isOwner: Boolean(item?.is_owner),
      isPinned: Boolean(item?.is_pinned),
      isVerified: Boolean(item?.author?.is_verified)
    };
  }

  private static extractContinuationToken(comments: any): string | null {
    if (!comments) return null;
    return comments.continuation || (Array.isArray(comments.contents) ? (comments.contents as any).continuation : null) || null;
  }
}
