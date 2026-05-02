import { useRef, useEffect } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { getHashtag } from '../lib/api';
import { VideoGrid } from '../components/video/video-grid';
import { Loader2 } from 'lucide-react';
import { ErrorPage } from './error-page';

export function HashtagPage() {
  const { tag } = useParams<{ tag: string }>();
  const normalizedTag = tag?.replace(/^#/, '') || '';

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
  } = useInfiniteQuery({
    queryKey: ['hashtag', normalizedTag],
    queryFn: ({ pageParam }) => getHashtag(normalizedTag, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.continuation,
    enabled: normalizedTag.length > 0
  });

  const observerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage) return;
    
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

  if (!normalizedTag) {
    return <p className="p-8 text-center text-zinc-500">ハッシュタグが指定されていません。</p>;
  }

  if (isError) {
    return <ErrorPage type="network" title="ハッシュタグの取得に失敗しました" />;
  }

  const items = data?.pages.flatMap(page => page.items) ?? [];
  const title = data?.pages[0]?.title || `#${normalizedTag}`;

  return (
    <div className="space-y-6">
      <div className="sticky top-14 z-20 -mx-4 bg-zinc-50/95 dark:bg-[#0f0f0f]/95 px-6 py-8 backdrop-blur border-b border-zinc-200 dark:border-zinc-800 transition-colors duration-300">
        <h1 className="text-3xl font-black text-zinc-900 dark:text-white">{title}</h1>
        <p className="mt-2 text-zinc-500">{items.length > 0 ? 'ハッシュタグに関連する動画' : '読み込み中...'}</p>
      </div>

      <div className="pt-4">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-x-4 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="animate-pulse space-y-3">
                <div className="aspect-video rounded-xl bg-zinc-200 dark:bg-zinc-800" />
                <div className="h-4 rounded bg-zinc-200 dark:bg-zinc-800" />
                <div className="h-3 w-2/3 rounded bg-zinc-200 dark:bg-zinc-800" />
              </div>
            ))}
          </div>
        ) : (
          <>
            <VideoGrid items={items} />
            {hasNextPage && (
              <div ref={observerRef} className="py-12 flex flex-col items-center justify-center gap-4">
                <Loader2 className="animate-spin text-zinc-400" size={32} />
                <p className="text-sm text-zinc-500">さらに読み込んでいます...</p>
              </div>
            )}
            {!hasNextPage && items.length > 0 && (
              <p className="py-12 text-center text-sm text-zinc-500">これ以上の動画はありません。</p>
            )}
            {items.length === 0 && !isLoading && (
              <p className="py-12 text-center text-sm text-zinc-500">動画が見つかりませんでした。</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
