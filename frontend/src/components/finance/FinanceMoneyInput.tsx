import * as React from 'react';

import { formatMoneyDisplay, parseMoneyInput } from '@/lib/finance-format';
import { cn } from '@/lib/utils';

type Props = {
  value: number;
  className?: string;
  onCommit: (value: number) => void;
};

export function FinanceMoneyInput({ value, className, onCommit }: Props) {
  const [text, setText] = React.useState(() => formatMoneyDisplay(value));

  React.useEffect(() => {
    setText(formatMoneyDisplay(value));
  }, [value]);

  return (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      className={cn(
        'finance-money-input h-9 w-full min-w-[5rem] max-w-[8rem] ml-auto border-0 bg-transparent text-right text-sm tabular-nums outline-none focus:bg-accent/10 dark:text-white',
        className,
      )}
      value={text}
      onChange={(e) => {
        const digits = e.target.value.replace(/[^\d]/g, '');
        if (!digits) {
          setText('');
          return;
        }
        setText(Number(digits).toLocaleString('en-US'));
      }}
      onBlur={() => {
        const n = parseMoneyInput(text);
        if (n !== value) onCommit(n);
        setText(formatMoneyDisplay(n));
      }}
    />
  );
}
