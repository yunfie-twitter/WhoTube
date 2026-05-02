import * as React from 'react';
import { cn } from '../../lib/utils';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = 'text', ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        className={cn(
          'flex h-10 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm',
          'placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-800',
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';
