import { useState } from 'react';
import { LinkifiedText } from './linkified-text';

interface Props {
  text?: string;
  maxLength?: number;
  maxLines?: number;
  className?: string;
}

export function ExpandableText({ text = '', maxLength = 140, maxLines, className = '' }: Props) {
  const [expanded, setExpanded] = useState(false);
  const normalized = String(text || '').trim();
  if (!normalized) return null;

  const lines = normalized.split(/\r?\n/);
  const isLong = normalized.length > maxLength || (typeof maxLines === 'number' && lines.length > maxLines);
  const clippedByLines = typeof maxLines === 'number' && lines.length > maxLines;
  const clippedText = clippedByLines ? lines.slice(0, maxLines).join('\n') : normalized.slice(0, maxLength).trimEnd();
  const visible = !isLong || expanded ? normalized : `${clippedText}...`;

  return (
    <div className={className}>
      <p className="whitespace-pre-wrap break-words text-sm leading-6 text-current">
        <LinkifiedText text={visible} />
      </p>
      {isLong ? (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="mt-2 text-sm font-semibold text-current underline-offset-4 hover:underline"
        >
          {expanded ? '閉じる' : '続きを見る'}
        </button>
      ) : null}
    </div>
  );
}
