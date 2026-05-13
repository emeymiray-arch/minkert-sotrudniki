import * as TabsPrimitive from '@radix-ui/react-tabs';
import * as React from 'react';

import { cn } from '@/lib/utils';

export const Tabs = TabsPrimitive.Root;

export const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(function TabsList({ className, ...props }, ref) {
  return (
    <TabsPrimitive.List
      ref={ref}
      className={cn(
        'inline-flex rounded-lg border border-stroke bg-black/[0.03] p-0.5 dark:border-white/[0.08] dark:bg-white/[0.04]',
        className,
      )}
      {...props}
    />
  );
});

export const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(function TabsTrigger({ className, ...props }, ref) {
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        'inline-flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-1.5 text-[13px] font-medium text-zinc-600 transition-colors',
        'data-[state=active]:bg-[hsl(var(--panel))] data-[state=active]:text-zinc-900 data-[state=active]:shadow-sm',
        'data-[state=inactive]:hover:text-zinc-900 dark:text-white/55 dark:data-[state=active]:bg-[hsl(var(--elevated))] dark:data-[state=active]:text-white dark:data-[state=inactive]:hover:text-white',
        className,
      )}
      {...props}
    />
  );
});

export const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(function TabsContent({ className, ...props }, ref) {
  return <TabsPrimitive.Content ref={ref} className={cn('mt-6 focus:outline-none', className)} {...props} />;
});
