import * as React from 'react';

import { cn } from '@/lib/utils';

export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('surface-panel p-6 text-zinc-900 dark:text-zinc-50', className)} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
}: {
  title: string;
  description?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div className="space-y-1">
        <h2 className="text-base font-semibold tracking-tight text-zinc-900 dark:text-white">{title}</h2>
        {description ?
          <p className="text-sm leading-relaxed text-muted dark:text-white/50">{description}</p>
        : null}
      </div>
    </div>
  );
}
