import { useState } from 'react';
import { X, Copy, MessageSquare, Share2, Mail, Link as LinkIcon, ChevronRight, ChevronDown, PlaySquare } from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoUrl: string;
  currentTime?: number;
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function ShareModal({ isOpen, onClose, videoUrl, currentTime = 0 }: ShareModalProps) {
  const [copied, setCopied] = useState(false);
  const [startAt, setStartAt] = useState(false);
  const [view, setView] = useState<'share' | 'embed'>('share');

  if (!isOpen) return null;

  const seconds = Math.floor(currentTime);
  const displayUrl = startAt ? `${videoUrl}?t=${seconds}` : videoUrl;
  const embedCode = `<iframe width="560" height="315" src="${videoUrl.replace('/watch/', '/embed/')}${startAt ? `?start=${seconds}` : ''}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; cast-api" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setView('share');
    onClose();
  };

  const shareTargets = [
    { 
      name: '埋め込む', 
      icon: <div className="flex h-full w-full items-center justify-center text-zinc-600"><span className="text-xl font-bold">&lt;&gt;</span></div>, 
      color: 'bg-white',
      onClick: () => setView('embed')
    },
    { name: 'X', icon: <div className="flex h-full w-full items-center justify-center text-white"><span className="text-xl font-bold">𝕏</span></div>, color: 'bg-black' },
    { name: 'メッセージ', icon: <MessageSquare className="h-7 w-7 text-white" />, color: 'bg-blue-500' },
    { name: 'WhatsApp', icon: <div className="h-7 w-7 text-white"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.414 0 0 5.414 0 12.05c0 2.123.552 4.197 1.603 6.02L0 24l6.135-1.61a11.817 11.817 0 005.915 1.57h.005c6.637 0 12.05-5.414 12.05-12.05a11.815 11.815 0 00-3.41-8.513z"/></svg></div>, color: 'bg-[#25D366]' },
    { name: 'Facebook', icon: <div className="h-7 w-7 text-white"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg></div>, color: 'bg-[#1877F2]' },
    { name: 'メール', icon: <Mail className="h-7 w-7 text-white" />, color: 'bg-zinc-600' }
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={handleClose}>
      <div 
        className={cn(
          "relative overflow-hidden rounded-xl bg-[#212121] text-zinc-100 shadow-2xl transition-all",
          view === 'embed' ? "w-full max-w-[900px]" : "w-full max-w-[500px]"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {view === 'share' ? (
          <>
            {/* Header */}
            <div className="flex items-center justify-between p-4">
              <h2 className="text-xl font-medium">共有</h2>
              <button onClick={onClose} className="rounded-full p-2 hover:bg-white/10">
                <X size={24} />
              </button>
            </div>

            <div className="h-[1px] w-full bg-zinc-800" />

            {/* Share Section */}
            <div className="p-6">
              <div className="relative">
                <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar">
                  {shareTargets.map((target) => (
                    <div key={target.name} className="flex flex-col items-center gap-2">
                      <button 
                        onClick={target.onClick}
                        className={cn("h-16 w-16 shrink-0 rounded-full flex items-center justify-center transition hover:opacity-80", target.color)}
                      >
                        {target.icon}
                      </button>
                      <span className="w-16 truncate text-center text-xs text-zinc-400">{target.name}</span>
                    </div>
                  ))}
                </div>
                <button className="absolute right-0 top-6 flex h-10 w-10 items-center justify-center rounded-full bg-[#3a3a3a] text-white shadow-lg">
                  <ChevronRight size={24} />
                </button>
              </div>

              {/* URL Copy Area */}
              <div className="mt-8 flex items-center gap-3 rounded-xl border border-zinc-700 bg-black/30 p-2 pl-4">
                <span className="min-w-0 flex-1 truncate text-sm text-zinc-200">{displayUrl}</span>
                <Button 
                  onClick={() => handleCopy(displayUrl)}
                  className={cn(
                    "h-10 rounded-full px-6 font-bold transition",
                    copied ? "bg-green-600 text-white" : "bg-[#3ea6ff] text-zinc-950 hover:bg-[#65b8ff]"
                  )}
                >
                  {copied ? 'コピーしました' : 'コピー'}
                </Button>
              </div>

              {/* Footer - Start At */}
              <div className="mt-8 flex items-center gap-3">
                <label className="flex cursor-pointer items-center gap-3">
                  <input 
                    type="checkbox" 
                    checked={startAt}
                    onChange={(e) => setStartAt(e.target.checked)}
                    className="h-5 w-5 rounded border-zinc-600 bg-transparent text-blue-500 accent-white"
                  />
                  <span className="text-sm text-zinc-300">開始位置 <span className="text-white ml-1 font-medium">{formatTime(seconds)}</span></span>
                </label>
              </div>
            </div>
          </>
        ) : (
          <div className="flex h-[500px]">
            {/* Preview Area */}
            <div className="relative flex flex-1 items-center justify-center bg-black">
              <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/60 to-transparent p-4">
                <p className="line-clamp-1 font-medium text-white">動画のプレビュー</p>
              </div>
              <div className="flex h-16 w-24 items-center justify-center rounded-2xl bg-red-600 shadow-xl transition hover:scale-110">
                <div className="border-y-[12px] border-l-[20px] border-y-transparent border-l-white ml-1" />
              </div>
              <div className="absolute bottom-4 left-4 flex gap-4 text-white/80">
                <Share2 size={20} />
                <div className="h-5 w-5 rounded-full border-2 border-current flex items-center justify-center">
                  <div className="h-2 w-0.5 bg-current rotate-0" />
                  <div className="h-2 w-0.5 bg-current rotate-90 absolute" />
                </div>
              </div>
              <div className="absolute bottom-4 right-4 flex items-center gap-2">
                <span className="text-xs font-bold text-white">見る</span>
                <div className="flex items-center gap-1 bg-white/20 px-2 py-1 rounded">
                   <PlaySquare size={14} className="fill-white" />
                   <span className="text-[10px] font-black italic">YouTube</span>
                </div>
              </div>
            </div>

            {/* Embed Code Area */}
            <div className="flex w-[350px] flex-col bg-[#1f1f1f] p-4">
              <div className="flex items-center justify-between pb-4">
                <h2 className="text-lg font-medium">動画の埋め込み</h2>
                <button onClick={() => setView('share')} className="rounded-full p-1 hover:bg-white/10">
                  <X size={20} />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto pr-2 no-scrollbar">
                <div className="rounded-md bg-black/40 p-3 text-xs font-mono leading-relaxed text-zinc-300">
                  {embedCode}
                </div>

                <div className="mt-6 space-y-4">
                  <div className="h-[1px] w-full bg-zinc-800" />
                  
                  <label className="flex cursor-pointer items-center gap-3">
                    <input 
                      type="checkbox" 
                      checked={startAt}
                      onChange={(e) => setStartAt(e.target.checked)}
                      className="h-5 w-5 rounded border-zinc-600 bg-transparent text-blue-500 accent-white"
                    />
                    <span className="text-sm text-zinc-300">開始位置 <span className="text-white ml-1 font-medium">{formatTime(seconds)}</span></span>
                  </label>

                  <div className="pt-4">
                    <button className="flex items-center justify-between w-full text-sm font-medium text-zinc-100 hover:text-white group">
                      埋め込みオプション
                      <ChevronDown size={18} className="text-zinc-500 group-hover:text-white" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <button 
                  onClick={() => handleCopy(embedCode)}
                  className="text-sm font-bold text-[#3ea6ff] hover:text-[#65b8ff] transition"
                >
                  {copied ? 'コピーしました' : 'コピー'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
