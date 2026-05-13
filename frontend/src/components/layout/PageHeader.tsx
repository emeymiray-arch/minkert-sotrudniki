import * as React from 'react';

import { cn } from '@/lib/utils';

type PageHeaderProps = {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
};

export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('flex flex-col gap-5 border-b border-stroke pb-8 dark:border-white/[0.06]', className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-white sm:text-[1.75rem] sm:leading-tight">
            {title}
          </h1>
          {description ?
            <p className="max-w-2xl text-[15px] leading-relaxed text-muted dark:text-white/50">{description}</p>
          : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
