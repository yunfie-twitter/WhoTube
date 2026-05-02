import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useIsFetching, useIsMutating } from '@tanstack/react-query';
import { cn } from '../../lib/utils';

export function ProgressBar() {
  const location = useLocation();
  const isFetching = useIsFetching();
  const isMutating = useIsMutating();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  // いずれかの通信が発生しているか
  const isLoading = isFetching > 0 || isMutating > 0;

  // ルート変更時、またはローディング開始時に進捗バーを表示
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    if (isLoading) {
      setVisible(true);
      setProgress(10);
      
      interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) return prev;
          // 最初は速く、だんだん遅く
          const diff = Math.max(1, (90 - prev) / 10);
          return prev + diff;
        });
      }, 200);
    } else {
      setProgress(100);
      const timer = setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 300);
      return () => clearTimeout(timer);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isLoading]);

  // ルート変更時にも一瞬表示（SPA遷移感）
  useEffect(() => {
    setVisible(true);
    setProgress(30);
    const timer = setTimeout(() => {
      if (!isLoading) {
        setProgress(100);
        const hideTimer = setTimeout(() => {
          setVisible(false);
          setProgress(0);
        }, 300);
        return () => clearTimeout(hideTimer);
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [location.pathname, location.search]);

  return (
    <div
      className={cn(
        'fixed left-0 top-0 z-[9999] h-[3px] bg-[#ff0000] transition-all duration-300 ease-out',
        !visible && 'opacity-0'
      )}
      style={{
        width: `${progress}%`,
        boxShadow: progress > 0 ? '0 0 8px rgba(255, 0, 0, 0.4)' : 'none'
      }}
    />
  );
}
