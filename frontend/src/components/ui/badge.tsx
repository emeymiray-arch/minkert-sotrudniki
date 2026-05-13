import * as React from 'react';

import { cn } from '@/lib/utils';

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger';

export function Badge({
  className,
  tone = 'neutral',
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  const tones: Record<BadgeTone, string> = {
    neutral:
      'border border-stroke bg-black/[0.04] text-zinc-700 dark:border-white/[0.08] dark:bg-white/[0.06] dark:text-white/75',
    success: 'border border-emerald-300/35 bg-emerald-400/10 text-emerald-800 dark:border-emerald-400/25 dark:bg-emerald-400/15 dark:text-emerald-50',
    warning: 'border border-amber-300/35 bg-amber-400/10 text-amber-950 dark:border-amber-400/35 dark:bg-amber-300/15 dark:text-amber-50',
    danger: 'border border-rose-400/35 bg-rose-500/10 text-rose-950 dark:border-rose-400/35 dark:bg-rose-500/18 dark:text-rose-50',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold tracking-wide',
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
