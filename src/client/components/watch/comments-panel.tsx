import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BadgeCheck, ChevronDown, Heart, ListFilter, MoreVertical, Terminal, ThumbsDown, ThumbsUp, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { ExpandableText } from './expandable-text';
import { getCommentReplies } from '../../lib/api';
import { proxyImageUrl } from '../../lib/images';

interface Props {
  count?: string;
  comments: any[];
  videoId: string;
  sort: 'top' | 'newest';
  onSortChange: (sort: 'top' | 'newest') => void;
  fetchNextPage?: () => void;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
}

const DEVELOPER_CHANNEL_ID = 'UCfjIuWCkkuDGRs1NL4smgyg';

function textValue(value: any): string {
  return String(value?.text ?? value ?? '');
}

function firstLetter(value: string): string {
  return value.trim().slice(0, 1).toUpperCase() || '?';
}

function positiveCount(value: any): string {
  const text = textValue(value).trim();
  if (!text || text === '0') return '';
  return text;
}

function ReplyList({ videoId, commentId }: { videoId: string; commentId: string }) {
  const repliesQuery = useQuery({
    queryKey: ['comment-replies', videoId, commentId],
    queryFn: () => getCommentReplies(videoId, commentId),
    enabled: Boolean(videoId && commentId)
  });

  if (repliesQuery.isLoading) {
    return <p className="mt-4 text-sm text-zinc-500">返信を読み込み中...</p>;
  }

  return (
    <div className="mt-5 space-y-5">
      {(repliesQuery.data ?? []).filter((reply) => reply?.id !== commentId).map((reply, index) => {
        const author = textValue(reply?.author?.name ?? reply?.author) || 'User';
        return (
          <article key={String(reply?.id ?? index)} className="flex gap-3">
            {reply?.authorThumbnail ? (
              <img src={proxyImageUrl(reply.authorThumbnail)} alt={author} className="h-8 w-8 shrink-0 rounded-full bg-zinc-800 object-cover" />
            ) : (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-600 text-xs font-semibold text-white">
                {firstLetter(author)}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-zinc-100">{author}</span>
                {reply?.published ? <span className="text-xs text-zinc-400">{reply.published}</span> : null}
              </div>
              <ExpandableText text={textValue(reply?.content)} maxLength={150} className="mt-1 text-zinc-100" />
            </div>
          </article>
        );
      })}
    </div>
  );
}

export function CommentsPanel({ 
  count, 
  comments, 
  videoId, 
  sort, 
  onSortChange,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage
}: Props) {
  const [participationPrompt, setParticipationPrompt] = useState(false);
  const [openReplies, setOpenReplies] = useState<Record<string, boolean>>({});
  
  const observerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage || !fetchNextPage) return;
    
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        fetchNextPage();
      }
    }, { threshold: 0.1 });

    if (observerRef.current) {
      observer.observe(observerRef.current);
    }

    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <section className="pt-3 text-zinc-900 dark:text-zinc-100">
      {/* Participation Prompt ... */}
      {participationPrompt ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 text-zinc-900 shadow-2xl dark:bg-[#282828] dark:text-zinc-100">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white">会話に参加しますか？</h3>
            <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300">コメントや評価を続行するにはYouTubeを開いてください。</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setParticipationPrompt(false)} className="rounded-full px-4 py-2 text-sm font-semibold text-zinc-500 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-[#3a3a3a]">
                キャンセル
              </button>
              <button type="button" onClick={() => setParticipationPrompt(false)} className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex items-center gap-6">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-white">コメント {count || `${comments.length} 件`}</h2>
        <button
          type="button"
          onClick={() => onSortChange(sort === 'top' ? 'newest' : 'top')}
          className="inline-flex items-center gap-2 text-sm font-bold text-zinc-700 hover:text-zinc-900 dark:text-zinc-100 dark:hover:text-white"
        >
          <ListFilter size={22} strokeWidth={2} />
          {sort === 'top' ? '並べ替え' : '新しい順'}
        </button>
      </div>

      <div className="mt-6 flex items-center gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-sm font-bold text-white shadow-lg">
          U
        </div>
        <div className="relative flex-1">
          <input
            onFocus={() => setParticipationPrompt(true)}
            className="w-full border-b border-zinc-300 bg-transparent py-2 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-900 dark:border-zinc-700 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-white"
            placeholder="コメントを追加..."
            readOnly
          />
        </div>
      </div>

      <div className="mt-7 space-y-7">
        {comments
          .map((comment, i) => {
          const author = textValue(comment?.author?.name ?? comment?.author) || 'User';
          const content = textValue(comment?.content);
          const replies = positiveCount(comment?.replyCount);
          const likes = positiveCount(comment?.likeCount);

          return (
            <article key={String(comment?.id ?? i)} className="relative flex gap-3">
              <div className="relative shrink-0">
                {comment?.authorThumbnail ? (
                  <img src={proxyImageUrl(comment.authorThumbnail)} alt={author} className="h-10 w-10 rounded-full bg-zinc-100 object-cover dark:bg-zinc-800" />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-600 text-sm font-semibold text-white">
                    {firstLetter(author)}
                  </div>
                )}
                {replies ? <span className="absolute left-1/2 top-12 h-[calc(100%+1.25rem)] w-px -translate-x-1/2 bg-zinc-200 dark:bg-zinc-700" /> : null}
              </div>

              <div className="min-w-0 flex-1">
                {comment?.isPinned ? <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">{author} さんによって固定されています</p> : null}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={comment?.isPinned ? 'rounded bg-zinc-200 px-1.5 py-0.5 text-xs font-bold text-zinc-950' : 'text-sm font-semibold text-zinc-900 dark:text-zinc-100'}>
                        {author}
                      </span>
                      {comment?.authorId === DEVELOPER_CHANNEL_ID && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-tighter text-white shadow-sm ring-1 ring-white/10">
                          <Terminal size={10} />
                          開発者
                        </span>
                      )}
                      {comment?.isVerified ? <BadgeCheck size={14} className="text-zinc-400 dark:text-zinc-300" /> : null}
                      {comment?.published ? <span className="text-xs text-zinc-500 dark:text-zinc-400">{comment.published}</span> : null}
                    </div>
                    <ExpandableText text={content} maxLength={150} className="mt-1 text-zinc-800 dark:text-zinc-100" />
                  </div>
                  <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full text-zinc-700 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-[#272727]">
                    <MoreVertical size={18} />
                  </Button>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-4 text-xs font-semibold text-zinc-500 dark:text-zinc-300">
                  <button type="button" onClick={() => setParticipationPrompt(true)} className="inline-flex items-center gap-2 hover:text-zinc-900 dark:hover:text-white">
                    <ThumbsUp size={15} />
                    {likes}
                  </button>
                  <button type="button" onClick={() => setParticipationPrompt(true)} className="hover:text-zinc-900 dark:hover:text-white">
                    <ThumbsDown size={15} />
                  </button>
                  <button type="button" onClick={() => setParticipationPrompt(true)} className="hover:text-zinc-900 dark:hover:text-white">返信</button>
                  {comment?.isHearted ? (
                    <span className="inline-flex items-center gap-1 text-red-500">
                      <Heart size={15} fill="currentColor" />
                    </span>
                  ) : null}
                </div>

                {replies ? (
                  <button
                    type="button"
                    onClick={() => setOpenReplies((value) => ({ ...value, [comment.id]: !value[comment.id] }))}
                    className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    {replies} 件の返信
                    <ChevronDown size={17} className={openReplies[comment.id] ? 'rotate-180' : ''} />
                  </button>
                ) : null}
                {openReplies[comment.id] ? <ReplyList videoId={videoId} commentId={comment.id} /> : null}
              </div>
            </article>
          );
        })}
      </div>
      
      {hasNextPage && (
        <div ref={observerRef} className="py-10 flex flex-col items-center justify-center gap-3">
          <Loader2 className="animate-spin text-zinc-400" size={24} />
          <p className="text-xs text-zinc-500">コメントを読み込んでいます...</p>
        </div>
      )}
    </section>
  );
}
