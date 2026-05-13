import * as React from 'react';

import { cn } from '@/lib/utils';

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'min-h-[96px] w-full rounded-lg border border-stroke bg-[hsl(var(--panel))] px-3 py-2 text-[13px] outline-none placeholder:text-muted',
        'transition focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring-focus)/0.35)] dark:border-white/[0.1] dark:bg-[hsl(var(--elevated))] dark:text-white',
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';
