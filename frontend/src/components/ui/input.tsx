import * as React from 'react';

import { cn } from '@/lib/utils';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => {
  return (
    <input
      ref={ref}
      className={cn(
        'flex h-9 w-full rounded-lg border border-stroke bg-[hsl(var(--panel))] px-3 text-[13px] outline-none placeholder:text-muted',
        'ring-offset-[hsl(var(--bg))] transition focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring-focus)/0.35)] dark:border-white/[0.1] dark:bg-[hsl(var(--elevated))] dark:text-white',
        className,
      )}
      {...props}
    />
  );
});
Input.displayName = 'Input';
