import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { apiJson } from '@/lib/http';

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
              className="flex items-center gap-3 rounded-xl border border-stroke bg-[hsl(var(--panel))] px-3 py-2 dark:border-white/[0.08]"
            >
              <Checkbox
                checked={p.resolved}
                onCheckedChange={(c) => patchMu.mutate({ id: p.id, resolved: Boolean(c) })}
              />
              <div className="min-w-0 flex-1">
                <div className={`text-sm ${p.resolved ? 'line-through text-muted dark:text-white/40' : 'text-zinc-900 dark:text-white'}`}>
                  {p.title}
                </div>
                {p.resolvedAt ?
                  <div className="text-[11px] text-muted dark:text-white/45">Решено: {p.resolvedAt.slice(0, 10)}</div>
                : null}
              </div>
              <button
                type="button"
                className="text-rose-600/80 hover:text-rose-700"
                onClick={() => deleteMu.mutate(p.id)}
                aria-label="Удалить проблему"
                title="Удалить"
              >
                <Trash2 className="size-4" />
              </button>
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
