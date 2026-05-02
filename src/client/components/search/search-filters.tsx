import { X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useEffect } from 'react';
import { SearchFilters as SearchFiltersType } from '../../lib/api';

interface SearchFiltersProps {
  onClose: () => void;
  onApply: (filters: SearchFiltersType) => void;
  className?: string;
}

const filterGroups = [
  {
    title: 'タイプ',
    items: [
      { label: '動画', value: { type: 'video' } },
      { label: 'ショート動画', value: { type: 'video' } },
      { label: 'チャンネル', value: { type: 'channel' } },
      { label: '再生リスト', value: { type: 'playlist' } },
      { label: '映画', value: { type: 'movie' } }
    ]
  },
  {
    title: '時間',
    items: [
      { label: '3 分未満', value: { duration: 'short' } },
      { label: '3〜20 分', value: { duration: 'any' } },
      { label: '20 分以上', value: { duration: 'long' } }
    ]
  },
  {
    title: 'アップロード日',
    items: [
      { label: '今日', value: { period: 'day' } },
      { label: '今週', value: { period: 'week' } },
      { label: '今月', value: { period: 'month' } },
      { label: '今年', value: { period: 'year' } }
    ]
  },
  {
    title: '特徴',
    items: [
      { label: 'ライブ', value: { features: ['live'] } },
      { label: '4K', value: { features: ['4k'] } },
      { label: 'HD', value: { features: ['hd'] } },
      { label: '字幕', value: { features: ['subtitles'] } },
      { label: 'クリエイティブ・コモンズ', value: { features: ['creative_commons'] } },
      { label: '360°', value: { features: ['360'] } },
      { label: 'VR180', value: { features: ['vr180'] } },
      { label: '3D', value: { features: ['3d'] } },
      { label: 'HDR', value: { features: ['hdr'] } },
      { label: '場所', value: { features: ['location'] } },
      { label: '購入済み', value: { features: ['purchased'] } }
    ]
  },
  {
    title: '優先設定',
    items: [
      { label: '関連度順', value: { sort: 'relevance' } },
      { label: '人気度', value: { sort: 'view_count' } }
    ]
  }
];

export function SearchFilters({ onClose, onApply, className }: SearchFiltersProps) {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  const handleSelect = (value: SearchFiltersType) => {
    onApply(value);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300" 
        onClick={onClose}
      />
      
      <div className={cn(
        "relative w-full max-w-5xl bg-zinc-50 dark:bg-[#0f0f0f] rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300",
        className
      )}>
        <div className="px-6 py-8 sm:px-10 sm:py-10">
          <div className="flex items-center justify-between mb-10">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">検索フィルタ</h2>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-zinc-200 dark:hover:bg-[#272727] rounded-full transition-all hover:scale-110 active:scale-95"
            >
              <X className="w-7 h-7 text-zinc-600 dark:text-zinc-400" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-8 gap-y-12">
            {filterGroups.map((group) => (
              <div key={group.title} className="flex flex-col gap-6">
                <div className="relative">
                  <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-[0.15em] pb-3">
                    {group.title}
                  </h3>
                  <div className="absolute bottom-0 left-0 w-full h-[1px] bg-zinc-200 dark:bg-zinc-800" />
                </div>
                <ul className="flex flex-col gap-5">
                  {group.items.map((item) => (
                    <li key={item.label}>
                      <button 
                        onClick={() => handleSelect(item.value)}
                        className="text-sm font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors text-left w-full"
                      >
                        {item.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        
        <div className="bg-zinc-100 dark:bg-[#1a1a1a] px-10 py-4 flex justify-end lg:hidden">
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 rounded-full font-bold text-sm"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
