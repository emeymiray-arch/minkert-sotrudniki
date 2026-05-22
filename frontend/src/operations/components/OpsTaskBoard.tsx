import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { GripVertical, Pin, Plus, Trash2 } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { apiJson } from '@/lib/http';
import { todayIso } from '@/operations/constants';
import type { OpsTask, OpsTaskStatus, OpsTimeBlock } from '@/operations/types';
import { OPS_STATUS_LABELS } from '@/operations/types';

const STATUSES: OpsTaskStatus[] = ['DONE', 'NOT_DONE', 'PARTIAL', 'OVERDUE', 'NEEDS_ATTENTION', 'PENDING'];

type Props = {
  block: OpsTimeBlock;
  title: string;
  description?: string;
};

export function OpsTaskBoard({ block, title, description }: Props) {
  const [date, setDate] = React.useState(todayIso());
  const [newTitle, setNewTitle] = React.useState('');
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const [commentDraft, setCommentDraft] = React.useState('');
  const qc = useQueryClient();

  const tasksQ = useQuery({
    queryKey: ['ops', 'tasks', block, date],
    queryFn: () => apiJson<{ items: OpsTask[]; forDate: string }>(`/operations/tasks?block=${block}&date=${date}`),
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['ops', 'tasks', block, date] });
    void qc.invalidateQueries({ queryKey: ['ops', 'dashboard'] });
  };

  const createMu = useMutation({
    mutationFn: () =>
      apiJson<OpsTask>('/operations/tasks', {
        method: 'POST',
        body: JSON.stringify({ block, title: newTitle, forDate: date }),
      }),
    onSuccess: () => {
      setNewTitle('');
      invalidate();
      toast.success('Задача добавлена');
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Ошибка'),
  });

  const patchMu = useMutation({
    mutationFn: ({ id, ...body }: { id: string; status?: OpsTaskStatus; pinned?: boolean; title?: string }) =>
      apiJson<OpsTask>(`/operations/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: invalidate,
  });

  const deleteMu = useMutation({
    mutationFn: (id: string) => apiJson(`/operations/tasks/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      invalidate();
      toast.success('Удалено');
    },
  });

  const dupMu = useMutation({
    mutationFn: (id: string) => apiJson(`/operations/tasks/${id}/duplicate`, { method: 'POST' }),
    onSuccess: () => {
      invalidate();
      toast.success('Дубликат создан');
    },
  });

  const commentMu = useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) =>
      apiJson(`/operations/tasks/${id}/comments`, { method: 'POST', body: JSON.stringify({ body }) }),
    onSuccess: () => {
      setCommentDraft('');
      invalidate();
      toast.success('Комментарий сохранён');
    },
  });

  const items = tasksQ.data?.items ?? [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title={title} description={description ?? 'Задачи блока с отметками, комментариями и историей.'} />
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs text-muted dark:text-white/50">
            Дата
            <Input type="date" className="mt-1 w-[160px]" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <div className="flex flex-1 min-w-[200px] gap-2">
            <Input placeholder="Новая задача…" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
            <Button disabled={!newTitle.trim() || createMu.isPending} onClick={() => createMu.mutate()}>
              <Plus className="size-4" />
            </Button>
          </div>
        </div>
      </Card>

      {tasksQ.isLoading ?
        <Skeleton className="h-[200px]" />
      : items.length === 0 ?
        <div className="rounded-xl border border-dashed border-stroke px-4 py-12 text-center text-sm text-muted dark:border-white/10">
          Нет задач — добавьте первую.
        </div>
      : <ul className="space-y-2">
          {items.map((task) => (
            <li
              key={task.id}
              className="rounded-xl border border-stroke bg-[hsl(var(--panel))] p-4 dark:border-white/[0.08]"
            >
              <div className="flex flex-wrap items-start gap-2">
                <GripVertical className="mt-1 size-4 shrink-0 text-muted opacity-40" aria-hidden />
                {task.pinned ?
                  <Pin className="size-4 text-accent" aria-hidden />
                : null}
                <div className="min-w-0 flex-1">
                  <Input
                    className="border-transparent bg-transparent px-0 font-semibold shadow-none"
                    value={task.title}
                    onChange={(e) => patchMu.mutate({ id: task.id, title: e.target.value })}
                    onBlur={(e) => {
                      if (e.target.value !== task.title) patchMu.mutate({ id: task.id, title: e.target.value });
                    }}
                  />
                  {task.assignee ?
                    <div className="text-xs text-muted dark:text-white/45">{task.assignee.name}</div>
                  : null}
                  {task.markedAt ?
                    <div className="mt-1 text-[11px] text-muted dark:text-white/40">
                      {task.markedByName} · {new Date(task.markedAt).toLocaleString('ru-RU')}
                    </div>
                  : null}
                </div>
                <Badge
                  tone={
                    task.status === 'DONE' ? 'success'
                    : task.status === 'OVERDUE' ? 'warning'
                    : task.status === 'NEEDS_ATTENTION' ? 'warning'
                    : 'neutral'
                  }
                >
                  {OPS_STATUS_LABELS[task.status]}
                </Badge>
              </div>

              <div className="mt-3 flex flex-wrap gap-1">
                {STATUSES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => patchMu.mutate({ id: task.id, status: s })}
                    className={`rounded-lg px-2 py-1 text-[11px] font-medium transition ${
                      task.status === s ?
                        'bg-accent/25 text-zinc-900 dark:text-white'
                      : 'bg-black/[0.04] text-muted dark:bg-white/[0.06] dark:text-white/55'
                    }`}
                  >
                    {OPS_STATUS_LABELS[s]}
                  </button>
                ))}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setExpanded(expanded === task.id ? null : task.id)}>
                  Комментарий
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => patchMu.mutate({ id: task.id, pinned: !task.pinned })}>
                  {task.pinned ? 'Открепить' : 'Закрепить'}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => dupMu.mutate(task.id)}>
                  Дублировать
                </Button>
                <Button type="button" variant="ghost" size="sm" className="text-rose-600" onClick={() => deleteMu.mutate(task.id)}>
                  <Trash2 className="size-4" />
                </Button>
              </div>

              {expanded === task.id ?
                <div className="mt-3 space-y-2 border-t border-stroke pt-3 dark:border-white/[0.08]">
                  <Textarea
                    placeholder="Комментарий…"
                    value={commentDraft}
                    onChange={(e) => setCommentDraft(e.target.value)}
                  />
                  <Button size="sm" disabled={!commentDraft.trim()} onClick={() => commentMu.mutate({ id: task.id, body: commentDraft })}>
                    Сохранить
                  </Button>
                  {(task.comments ?? []).map((c) => (
                    <div key={c.id} className="rounded-lg bg-black/[0.03] px-3 py-2 text-xs dark:bg-white/[0.04]">
                      <strong>{c.authorName}</strong>: {c.body}
                    </div>
                  ))}
                </div>
              : null}
            </li>
          ))}
        </ul>
      }
    </div>
  );
}
