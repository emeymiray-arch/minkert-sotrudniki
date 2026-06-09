import * as React from 'react';

import { Button } from '@/components/ui/button';

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-white">Что-то пошло не так</h1>
          <p className="text-sm text-muted dark:text-white/55">{this.state.error.message}</p>
          <Button type="button" onClick={() => window.location.reload()}>
            Обновить страницу
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
