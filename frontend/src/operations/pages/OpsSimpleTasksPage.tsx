import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Pencil, Plus, Trash2 } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { apiJson } from '@/lib/http';
import { todayIso } from '@/operations/constants';

type OpsTaskItem = {
  id: string;
  title: string;
  description: string;
  status: string;
  categoryLabel: string;
  forDate: string;
};

type BoardResponse = {
  forDate: string;
  items: OpsTaskItem[];
  overdue: OpsTaskItem[];
};

export default function OpsSimpleTasksPage() {
  const qc = useQueryClient();
  const [date, setDate] = React.useState(todayIso());
  const [newTitle, setNewTitle] = React.useState('');
  const [newTag, setNewTag] = React.useState('');
  const [editOpen, setEditOpen] = React.useState(false);
  const [editId, setEditId] = React.useState<string | null>(null);
  const [editTitle, setEditTitle] = React.useState('');
  const [editTag, setEditTag] = React.useState('');
  const [editDescription, setEditDescription] = React.useState('');

  const board = useQuery({
    queryKey: ['ops-tasks-all', date],
    queryFn: () =>
      apiJson<BoardResponse>(`/operations/tasks/all?date=${encodeURIComponent(date)}`),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['ops-tasks-all', date] });

  const createTask = useMutation({
    mutationFn: () =>
      apiJson('/operations/tasks', {
        method: 'POST',
        body: JSON.stringify({
          block: 'DAY',
          title: newTitle.trim(),
          forDate: date,
          categoryLabel: newTag.trim(),
          checkType: 'NONE',
        }),
      }),
    onSuccess: async () => {
      setNewTitle('');
      setNewTag('');
      await invalidate();
      toast.success('Задача добавлена');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleDone = useMutation({
    mutationFn: ({ id, done }: { id: string; done: boolean }) =>
      apiJson(`/operations/tasks/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: done ? 'DONE' : 'PENDING' }),
      }),
    onSuccess: invalidate,
  });

  const saveEdit = useMutation({
    mutationFn: () =>
      apiJson(`/operations/tasks/${editId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: editTitle.trim(),
          categoryLabel: editTag.trim(),
          description: editDescription.trim(),
        }),
      }),
    onSuccess: async () => {
      setEditOpen(false);
      await invalidate();
      toast.success('Сохранено');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeTask = useMutation({
    mutationFn: (id: string) =>
      apiJson(`/operations/tasks/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      await invalidate();
      toast.success('Удалено');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openEdit = (task: OpsTaskItem) => {
    setEditId(task.id);
    setEditTitle(task.title);
    setEditTag(task.categoryLabel ?? '');
    setEditDescription(task.description ?? '');
    setEditOpen(true);
  };

  const items = board.data?.items ?? [];
  const overdue = board.data?.overdue ?? [];
  const pending = items.filter((t) => t.status !== 'DONE');
  const done = items.filter((t) => t.status === 'DONE');

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-[12px] font-medium text-muted">Дата</label>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-[160px]"
          />
        </div>
      </div>

      <Card className="space-y-3 p-4">
        <p className="text-[13px] font-semibold text-zinc-900 dark:text-white">Добавить задачу</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            placeholder="Что нужно проконтролировать"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newTitle.trim()) createTask.mutate();
            }}
          />
          <Input
            placeholder="Тег (необязательно)"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            className="sm:max-w-[160px]"
          />
          <Button
            onClick={() => createTask.mutate()}
            disabled={!newTitle.trim() || createTask.isPending}
          >
            <Plus className="size-4" />
            Добавить
          </Button>
        </div>
      </Card>

      {board.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <>
          {overdue.length > 0 && (
            <TaskSection
              title={`Просрочено (${overdue.length})`}
              tasks={overdue}
              onToggle={(id, done) => toggleDone.mutate({ id, done })}
              onEdit={openEdit}
              onDelete={(id) => removeTask.mutate(id)}
            />
          )}

          <TaskSection
            title={`На сегодня (${pending.length})`}
            tasks={pending}
            onToggle={(id, done) => toggleDone.mutate({ id, done })}
            onEdit={openEdit}
            onDelete={(id) => removeTask.mutate(id)}
            emptyText="Нет активных задач — добавьте выше"
          />

          {done.length > 0 && (
            <TaskSection
              title={`Сделано (${done.length})`}
              tasks={done}
              muted
              onToggle={(id, done) => toggleDone.mutate({ id, done })}
              onEdit={openEdit}
              onDelete={(id) => removeTask.mutate(id)}
            />
          )}
        </>
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogTitle>Редактировать задачу</DialogTitle>
          <div className="space-y-3 pt-2">
            <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
            <Input
              placeholder="Тег"
              value={editTag}
              onChange={(e) => setEditTag(e.target.value)}
            />
            <Textarea
              placeholder="Заметка (необязательно)"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              rows={3}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditOpen(false)}>
                Отмена
              </Button>
              <Button onClick={() => saveEdit.mutate()} disabled={!editTitle.trim()}>
                Сохранить
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TaskSection({
  title,
  tasks,
  onToggle,
  onEdit,
  onDelete,
  emptyText,
  muted,
}: {
  title: string;
  tasks: OpsTaskItem[];
  onToggle: (id: string, done: boolean) => void;
  onEdit: (task: OpsTaskItem) => void;
  onDelete: (id: string) => void;
  emptyText?: string;
  muted?: boolean;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-stroke px-4 py-2.5 dark:border-white/10">
        <h2 className="text-[13px] font-semibold text-zinc-900 dark:text-white">{title}</h2>
      </div>
      {tasks.length === 0 ? (
        <p className="px-4 py-6 text-[13px] text-muted">{emptyText ?? 'Пусто'}</p>
      ) : (
        <ul className="divide-y divide-stroke dark:divide-white/10">
          {tasks.map((task) => {
            const isDone = task.status === 'DONE';
            return (
              <li
                key={task.id}
                className={`flex items-start gap-3 px-4 py-3 ${muted ? 'opacity-70' : ''}`}
              >
                <Checkbox
                  checked={isDone}
                  onCheckedChange={(v) => onToggle(task.id, Boolean(v))}
                  className="mt-0.5"
                />
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-[14px] font-medium ${isDone ? 'line-through text-muted' : 'text-zinc-900 dark:text-white'}`}
                  >
                    {task.title}
                  </p>
                  {task.categoryLabel ? (
                    <span className="mt-1 inline-block rounded-md bg-black/[0.05] px-2 py-0.5 text-[11px] text-muted dark:bg-white/10">
                      {task.categoryLabel}
                    </span>
                  ) : null}
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button size="icon" variant="ghost" onClick={() => onEdit(task)} aria-label="Изменить">
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => onDelete(task.id)}
                    aria-label="Удалить"
                  >
                    <Trash2 className="size-4 text-red-500" />
                  </Button>
                  {isDone ? <Check className="mt-2 size-4 text-emerald-500" aria-hidden /> : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
