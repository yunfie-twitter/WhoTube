import { useMemo, useState } from 'react';
import { Button } from '../components/ui/button';
import { VideoGrid } from '../components/video/video-grid';
import { clearHistory, readHistory } from '../lib/history';

export function HistoryPage() {
  const [version, setVersion] = useState(0);
  const items = useMemo(() => readHistory(), [version]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-white">履歴</h1>
        <Button
          variant="secondary"
          className="rounded-full bg-[#272727] text-zinc-100 hover:bg-[#3a3a3a]"
          onClick={() => {
            clearHistory();
            setVersion((value) => value + 1);
          }}
        >
          履歴を削除
        </Button>
      </div>
      {items.length ? <VideoGrid items={items} /> : <p className="py-12 text-center text-sm text-zinc-500">再生履歴はまだありません。</p>}
    </div>
  );
}
