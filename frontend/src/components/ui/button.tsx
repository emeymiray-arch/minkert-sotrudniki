import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-[13px] font-semibold tracking-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring-focus)/0.45)] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--bg))] disabled:pointer-events-none disabled:opacity-40 active:scale-[0.99]',
  {
    variants: {
      variant: {
        primary: 'bg-accent text-accent-fg shadow-sm hover:opacity-95 dark:shadow-none',
        ghost: 'text-zinc-700 hover:bg-black/[0.06] dark:text-white/80 dark:hover:bg-white/[0.06]',
        outline:
          'border border-stroke bg-transparent text-zinc-900 hover:bg-black/[0.04] dark:border-white/[0.1] dark:text-white dark:hover:bg-white/[0.05]',
        subtle: 'bg-black/[0.06] text-zinc-900 hover:bg-black/[0.09] dark:bg-white/[0.06] dark:text-white dark:hover:bg-white/[0.09]',
      },
      size: {
        sm: 'h-8 px-3 text-[12px]',
        md: 'h-9 px-3.5',
        lg: 'h-10 px-5 text-[14px]',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, type = 'button', ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return <Comp className={cn(buttonVariants({ variant, size }), className)} ref={ref} type={type} {...props} />;
  },
);
Button.displayName = 'Button';
