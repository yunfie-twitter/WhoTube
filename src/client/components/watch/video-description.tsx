import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';
import { ExpandableText } from './expandable-text';

interface Props {
  description?: string;
  viewCount?: number;
  likeCount?: number | null;
  published?: string;
  category?: string;
  tags?: string[];
}

function formatCount(value?: number | null): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  return new Intl.NumberFormat('ja-JP').format(value);
}

export function VideoDescription({ description, viewCount, likeCount, published, category, tags = [] }: Props) {
  const chips = [
    formatCount(viewCount) ? `${formatCount(viewCount)} 回視聴` : null,
    formatCount(likeCount) ? `${formatCount(likeCount)} いいね` : null,
    published || null,
    category || null
  ].filter(Boolean);

  if (!description && chips.length === 0 && tags.length === 0) return null;

  return (
    <div className="rounded-xl bg-black/5 p-3 text-zinc-700 transition-colors hover:bg-black/10 dark:bg-white/5 dark:text-zinc-100 dark:hover:bg-white/10 md:p-4">
      <div className="space-y-3">
        {chips.length ? (
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {chips.map((chip) => (
              <span key={chip} className="text-sm font-bold text-zinc-900 dark:text-white">
                {chip}
              </span>
            ))}
          </div>
        ) : null}
        <ExpandableText text={description} maxLength={260} maxLines={3} className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-200" />
        {tags.length ? (
          <div className="flex flex-wrap gap-2 pt-1">
            {tags.slice(0, 16).map((tag) => (
              <span key={tag} className="text-xs font-medium text-sky-600 dark:text-sky-400 hover:underline cursor-pointer">
                #{tag}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
