import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { apiJson } from '@/lib/http';
import { OPS_CHECK_TYPE_ORDER, OPS_SORT_CATEGORIES, todayIso } from '@/operations/constants';
import { OpsTaskCheckPanel } from '@/operations/components/OpsTaskCheckPanel';
import { CHECK_TYPE_LABEL } from '@/operations/check-labels';
import type { OpsBoard, OpsTask, OpsTaskCheckType, OpsTaskStatus, OpsTimeBlock } from '@/operations/types';

const selectClass =
  'h-8 max-w-[11rem] shrink-0 rounded-lg border border-stroke bg-transparent px-2 text-[11px] dark:border-white/10';

type Props = {
  block: OpsTimeBlock;
  title: string;
};

export function OpsTaskBoard({ block, title }: Props) {
  const [date, setDate] = React.useState(todayIso());
  const [newTitle, setNewTitle] = React.useState('');
  const [journalTaskId, setJournalTaskId] = React.useState<string | null>(null);
  const qc = useQueryClient();

  const boardQ = useQuery({
    queryKey: ['ops', 'board', block, date],
    queryFn: () => apiJson<OpsBoard>(`/operations/board?block=${block}&date=${date}`),
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['ops', 'board', block, date] });
    void qc.invalidateQueries({ queryKey: ['ops', 'dashboard'] });
  };

  const createTaskMu = useMutation({
    mutationFn: () =>
      apiJson<OpsTask>('/operations/tasks', {
        method: 'POST',
        body: JSON.stringify({
          block,
          title: newTitle,
          categoryLabel: OPS_SORT_CATEGORIES[0],
          checkType: 'GENERIC',
        }),
      }),
    onSuccess: () => {
      setNewTitle('');
      invalidate();
    },
  });

  const patchTaskMu = useMutation({
    mutationFn: ({
      id,
      ...body
    }: {
      id: string;
      status?: OpsTaskStatus;
      title?: string;
      categoryLabel?: string;
      checkType?: OpsTaskCheckType;
    }) => apiJson(`/operations/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: invalidate,
  });

  const deleteTaskMu = useMutation({
    mutationFn: (id: string) => apiJson(`/operations/tasks/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });

  const tasks = boardQ.data?.tasks ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">{title}</h2>
        <div className="flex flex-col items-end gap-0.5">
          <label className="text-[10px] font-medium uppercase tracking-wide text-muted dark:text-white/40">
            Дата фиксации
          </label>
          <Input type="date" className="w-[160px]" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>

      <p className="text-xs text-muted dark:text-white/45">
        Список задач сохраняется — на следующий день он не очищается. Дата справа влияет только на журнал фиксации.
      </p>

      <div className="flex gap-2">
        <Input
          className="flex-1"
          placeholder="Новая задача…"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && newTitle.trim() && createTaskMu.mutate()}
        />
        <Button disabled={!newTitle.trim() || createTaskMu.isPending} onClick={() => createTaskMu.mutate()}>
          <Plus className="size-4" />
        </Button>
      </div>

      {boardQ.isLoading ?
        <Skeleton className="h-[160px]" />
      : tasks.length === 0 ?
        <p className="py-8 text-center text-sm text-muted dark:text-white/45">Нет задач — добавьте первую.</p>
      : <ul className="divide-y divide-stroke rounded-xl border border-stroke dark:divide-white/[0.08] dark:border-white/[0.08]">
          {tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              recordDate={date}
              journalOpen={journalTaskId === task.id}
              onToggleJournal={() => setJournalTaskId((id) => (id === task.id ? null : task.id))}
              onPatch={(body) => patchTaskMu.mutate({ id: task.id, ...body })}
              onDelete={() => deleteTaskMu.mutate(task.id)}
              onJournalSaved={invalidate}
            />
          ))}
        </ul>
      }
    </div>
  );
}

function TaskRow({
  task,
  recordDate,
  journalOpen,
  onToggleJournal,
  onPatch,
  onDelete,
  onJournalSaved,
}: {
  task: OpsTask;
  recordDate: string;
  journalOpen: boolean;
  onToggleJournal: () => void;
  onPatch: (body: {
    status?: OpsTaskStatus;
    title?: string;
    categoryLabel?: string;
    checkType?: OpsTaskCheckType;
  }) => void;
  onDelete: () => void;
  onJournalSaved: () => void;
}) {
  const checkType = task.checkType ?? 'GENERIC';
  const isDone = task.status === 'DONE';
  const j = task.checkJournal;

  return (
    <li className="px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
        <Checkbox
          checked={isDone}
          onCheckedChange={(c) => onPatch({ status: c ? 'DONE' : 'PENDING' })}
          className="shrink-0"
        />
        <input
          className={`min-w-0 flex-1 border-0 bg-transparent text-sm outline-none dark:text-white ${
            isDone ? 'text-muted line-through dark:text-white/40' : 'font-medium'
          }`}
          defaultValue={task.title}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v && v !== task.title) onPatch({ title: v });
          }}
        />
        <select
          className={selectClass}
          value={checkType}
          onChange={(e) => onPatch({ checkType: e.target.value as OpsTaskCheckType })}
          title="Тип фиксации"
        >
          {OPS_CHECK_TYPE_ORDER.map((k) => (
            <option key={k} value={k}>
              {CHECK_TYPE_LABEL[k]}
            </option>
          ))}
        </select>
        <select
          className={selectClass}
          value={task.categoryLabel || OPS_SORT_CATEGORIES[0]}
          onChange={(e) => onPatch({ categoryLabel: e.target.value })}
          title="Категория"
        >
          {OPS_SORT_CATEGORIES.map((label) => (
            <option key={label} value={label}>
              {label}
            </option>
          ))}
        </select>
        <Button
          type="button"
          variant={journalOpen ? 'primary' : 'ghost'}
          size="sm"
          className="h-8 shrink-0 px-2 text-[11px]"
          onClick={onToggleJournal}
        >
          {journalOpen ? 'Скрыть' : 'Фиксация'}
          {j && j.recorded > 0 ? ` (${j.recorded})` : ''}
        </Button>
        <button type="button" className="shrink-0 text-rose-500/80 hover:text-rose-600" onClick={onDelete}>
          <Trash2 className="size-4" />
        </button>
      </div>
      {journalOpen ?
        <OpsTaskCheckPanel
          taskId={task.id}
          recordDate={recordDate}
          checkType={checkType}
          compact
          onSaved={onJournalSaved}
        />
      : null}
    </li>
  );
}
