import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Trash2 } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { apiJson } from '@/lib/http';
import { cn } from '@/lib/utils';

type OpsProblem = {
  id: string;
  title: string;
  description: string;
  resolved: boolean;
  resolvedAt?: string | null;
  createdAt: string;
};

export default function OpsProblemsPage() {
  const qc = useQueryClient();
  const [title, setTitle] = React.useState('');

  const q = useQuery({
    queryKey: ['ops', 'problems'],
    queryFn: () => apiJson<OpsProblem[]>('/operations/problems'),
    staleTime: 60_000,
  });

  const createMu = useMutation({
    mutationFn: () =>
      apiJson('/operations/problems', {
        method: 'POST',
        body: JSON.stringify({ title }),
      }),
    onSuccess: () => {
      setTitle('');
      void qc.invalidateQueries({ queryKey: ['ops', 'problems'] });
    },
  });

  const patchMu = useMutation({
    mutationFn: ({ id, resolved }: { id: string; resolved: boolean }) =>
      apiJson(`/operations/problems/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ resolved }),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['ops', 'problems'] }),
  });

  const deleteMu = useMutation({
    mutationFn: (id: string) => apiJson(`/operations/problems/${id}`, { method: 'DELETE' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['ops', 'problems'] }),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Проблемы" description="Простой список: добавили проблему, решили — отметили галочкой." />
        <div className="flex gap-2">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Новая проблема…"
            onKeyDown={(e) => e.key === 'Enter' && title.trim() && createMu.mutate()}
          />
          <Button disabled={!title.trim() || createMu.isPending} onClick={() => createMu.mutate()}>
            Добавить
          </Button>
        </div>
      </Card>

      {q.isLoading ?
        <Skeleton className="h-[160px]" />
      : <ul className="space-y-2">
          {(q.data ?? []).map((p) => (
            <li
              key={p.id}
              className={cn(
                'flex items-center gap-3 rounded-xl border bg-[hsl(var(--panel))] px-3 py-2 dark:border-white/[0.08]',
                p.resolved ? 'border-emerald-500/40 bg-emerald-500/[0.06]' : 'border-stroke',
              )}
            >
              <div className="flex shrink-0 items-center">
                {p.resolved ?
                  <span
                    className="flex size-8 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                    aria-label="Решено"
                  >
                    <Check className="size-5 stroke-[2.5]" />
                  </span>
                : <Checkbox
                    checked={false}
                    onCheckedChange={() => patchMu.mutate({ id: p.id, resolved: true })}
                    aria-label="Отметить решённой"
                  />
                }
              </div>
              <div className="min-w-0 flex-1">
                <div
                  className={cn(
                    'text-sm',
                    p.resolved ?
                      'text-emerald-800 dark:text-emerald-300'
                    : 'text-zinc-900 dark:text-white',
                  )}
                >
                  {p.title}
                </div>
                {p.resolvedAt ?
                  <div className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80">
                    Решено: {p.resolvedAt.slice(0, 10)}
                  </div>
                : null}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {p.resolved ?
                  <button
                    type="button"
                    className="text-xs text-muted underline-offset-2 hover:underline dark:text-white/50"
                    onClick={() => patchMu.mutate({ id: p.id, resolved: false })}
                  >
                    Вернуть
                  </button>
                : null}
                <button
                  type="button"
                  className="text-rose-600/80 hover:text-rose-700"
                  onClick={() => deleteMu.mutate(p.id)}
                  aria-label="Удалить проблему"
                  title="Удалить"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </li>
          ))}
          {!q.data?.length ?
            <li className="rounded-xl border border-dashed border-stroke px-4 py-8 text-center text-sm text-muted dark:border-white/[0.08] dark:text-white/45">
              Проблем пока нет.
            </li>
          : null}
        </ul>
      }
    </div>
  );
}
