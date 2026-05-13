import { cn } from '@/lib/utils';

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn('animate-pulse rounded-xl bg-gradient-to-br from-white/15 to-transparent dark:from-white/10', className)} />
  );
}
