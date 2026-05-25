import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, GripVertical, Pin, Plus, Trash2 } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { apiJson } from '@/lib/http';
import { todayIso } from '@/operations/constants';
import { OpsTaskCheckPanel } from '@/operations/components/OpsTaskCheckPanel';
import { CHECK_TYPE_LABEL } from '@/operations/check-labels';
import type { OpsBoard, OpsCategory, OpsTask, OpsTaskCheckType, OpsTaskStatus, OpsTimeBlock } from '@/operations/types';
import { OPS_STATUS_LABELS } from '@/operations/types';

const COLLAPSE_KEY = 'ops.category.collapsed';

function readCollapsed(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(COLLAPSE_KEY) ?? '{}') as Record<string, boolean>;
  } catch {
    return {};
  }
}

function writeCollapsed(map: Record<string, boolean>) {
  localStorage.setItem(COLLAPSE_KEY, JSON.stringify(map));
}

type Props = {
  block: OpsTimeBlock;
  title: string;
  description?: string;
};

export function OpsTaskBoard({ block, title, description }: Props) {
  const [date, setDate] = React.useState(todayIso());
  const [newCategory, setNewCategory] = React.useState('');
  const [collapsed, setCollapsed] = React.useState<Record<string, boolean>>(readCollapsed);
  const [dragCatId, setDragCatId] = React.useState<string | null>(null);
  const [taskDrafts, setTaskDrafts] = React.useState<Record<string, string>>({});
  const qc = useQueryClient();

  const boardQ = useQuery({
    queryKey: ['ops', 'board', block, date],
    queryFn: () => apiJson<OpsBoard>(`/operations/board?block=${block}&date=${date}`),
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['ops', 'board', block, date] });
    void qc.invalidateQueries({ queryKey: ['ops', 'dashboard'] });
  };

  const createCategoryMu = useMutation({
    mutationFn: (t: string) =>
      apiJson('/operations/categories', {
        method: 'POST',
        body: JSON.stringify({ block, forDate: date, title: t }),
      }),
    onSuccess: () => {
      setNewCategory('');
      invalidate();
      toast.success('Категория создана');
    },
  });

  const patchCategoryMu = useMutation({
    mutationFn: ({ id, ...body }: { id: string; title?: string; pinned?: boolean }) =>
      apiJson(`/operations/categories/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: invalidate,
  });

  const deleteCategoryMu = useMutation({
    mutationFn: (id: string) => apiJson(`/operations/categories/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });

  const reorderCatsMu = useMutation({
    mutationFn: (orderedIds: string[]) =>
      apiJson('/operations/categories/reorder', { method: 'POST', body: JSON.stringify({ orderedIds }) }),
    onSuccess: invalidate,
  });

  const createTaskMu = useMutation({
    mutationFn: ({ categoryId, title: t }: { categoryId: string; title: string }) =>
      apiJson<OpsTask>('/operations/tasks', {
        method: 'POST',
        body: JSON.stringify({ block, forDate: date, categoryId, title: t }),
      }),
    onSuccess: (_d, vars) => {
      setTaskDrafts((prev) => ({ ...prev, [vars.categoryId]: '' }));
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
      categoryId?: string | null;
      checkType?: OpsTaskCheckType;
    }) => apiJson(`/operations/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: invalidate,
  });

  const deleteTaskMu = useMutation({
    mutationFn: (id: string) => apiJson(`/operations/tasks/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });

  const toggleCollapse = (id: string) => {
    setCollapsed((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      writeCollapsed(next);
      return next;
    });
  };

  const onCatDrop = (targetId: string) => {
    if (!dragCatId || dragCatId === targetId || !boardQ.data) return;
    const ids = boardQ.data.categories.map((c) => c.id);
    const from = ids.indexOf(dragCatId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    const next = [...ids];
    next.splice(from, 1);
    next.splice(to, 0, dragCatId);
    reorderCatsMu.mutate(next);
    setDragCatId(null);
  };

  const board = boardQ.data;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title={title} description={description ?? 'Категории и задачи на одном экране.'} />
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-muted dark:text-white/50">
            Дата
            <Input type="date" className="mt-1 w-[160px]" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <div className="flex min-w-[200px] flex-1 gap-2">
            <Input
              placeholder="Новая категория…"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
            />
            <Button
              variant="outline"
              disabled={!newCategory.trim() || createCategoryMu.isPending}
              onClick={() => createCategoryMu.mutate(newCategory.trim())}
            >
              <Plus className="size-4" />
            </Button>
          </div>
        </div>
      </Card>

      {boardQ.isLoading ?
        <Skeleton className="h-[320px]" />
      : !board ?
        null
      : <div className="space-y-5">
          {board.categories.map((cat) => (
            <CategorySection
              key={cat.id}
              category={cat}
              collapsed={Boolean(collapsed[cat.id])}
              taskDraft={taskDrafts[cat.id] ?? ''}
              onToggleCollapse={() => toggleCollapse(cat.id)}
              onTaskDraftChange={(v) => setTaskDrafts((p) => ({ ...p, [cat.id]: v }))}
              onAddTask={() => {
                const t = (taskDrafts[cat.id] ?? '').trim();
                if (t) createTaskMu.mutate({ categoryId: cat.id, title: t });
              }}
              onDragStart={() => setDragCatId(cat.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onCatDrop(cat.id)}
              onPin={() => patchCategoryMu.mutate({ id: cat.id, pinned: !cat.pinned })}
              onRename={(t) => patchCategoryMu.mutate({ id: cat.id, title: t })}
              onDelete={() => {
                if (confirm(`Удалить категорию «${cat.title}»? Задачи останутся без категории.`)) {
                  deleteCategoryMu.mutate(cat.id);
                }
              }}
              recordDate={date}
              onPatchTask={(id, body) => patchTaskMu.mutate({ id, ...body })}
              onDeleteTask={(id) => deleteTaskMu.mutate(id)}
              onJournalSaved={invalidate}
              categories={board.categories}
            />
          ))}

          {board.uncategorized.length > 0 ?
            <section className="rounded-xl border border-dashed border-stroke/80 px-4 py-3 dark:border-white/12">
              <h2 className="text-sm font-bold uppercase tracking-wide text-muted dark:text-white/45">Без категории</h2>
              <ul className="mt-2 space-y-1">
                {board.uncategorized.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    recordDate={date}
                    categories={board.categories}
                    onPatch={(body) => patchTaskMu.mutate({ id: task.id, ...body })}
                    onDelete={() => deleteTaskMu.mutate(task.id)}
                    onJournalSaved={invalidate}
                  />
                ))}
              </ul>
            </section>
          : null}
        </div>
      }
    </div>
  );
}

function CategorySection({
  category,
  collapsed,
  taskDraft,
  categories,
  onToggleCollapse,
  onTaskDraftChange,
  onAddTask,
  onDragStart,
  onDragOver,
  onDrop,
  onPin,
  onRename,
  onDelete,
  recordDate,
  onPatchTask,
  onDeleteTask,
  onJournalSaved,
}: {
  category: OpsCategory;
  collapsed: boolean;
  taskDraft: string;
  recordDate: string;
  categories: OpsCategory[];
  onToggleCollapse: () => void;
  onTaskDraftChange: (v: string) => void;
  onAddTask: () => void;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
  onPin: () => void;
  onRename: (title: string) => void;
  onDelete: () => void;
  onPatchTask: (
    id: string,
    body: { status?: OpsTaskStatus; title?: string; categoryId?: string | null; checkType?: OpsTaskCheckType },
  ) => void;
  onDeleteTask: (id: string) => void;
  onJournalSaved: () => void;
}) {
  const doneCount = category.tasks.filter((t) => t.status === 'DONE').length;

  return (
    <section
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={`rounded-xl border bg-[hsl(var(--panel))] dark:border-white/[0.08] ${
        category.pinned ? 'border-accent/40 shadow-sm' : 'border-stroke'
      }`}
    >
      <header className="flex flex-wrap items-center gap-2 border-b border-stroke/70 px-4 py-3 dark:border-white/[0.06]">
        <button type="button" className="text-muted" onClick={onToggleCollapse} aria-label={collapsed ? 'Развернуть' : 'Свернуть'}>
          {collapsed ?
            <ChevronRight className="size-5" />
          : <ChevronDown className="size-5" />}
        </button>
        <GripVertical className="size-4 cursor-grab text-muted opacity-50" aria-hidden />
        <Input
          className="min-w-0 flex-1 border-transparent bg-transparent px-0 text-base font-bold uppercase tracking-wide shadow-none dark:text-white"
          defaultValue={category.title}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v && v !== category.title) onRename(v);
          }}
        />
        <Badge tone="neutral">
          {category.taskCount} {category.taskCount === 1 ? 'задача' : 'задач'}
          {doneCount > 0 ? ` · ${doneCount} ✓` : ''}
        </Badge>
        <Button type="button" variant="ghost" size="sm" onClick={onPin} title="Закрепить категорию">
          <Pin className={`size-4 ${category.pinned ? 'text-accent' : 'opacity-40'}`} />
        </Button>
        <Button type="button" variant="ghost" size="sm" className="text-rose-600" onClick={onDelete}>
          <Trash2 className="size-4" />
        </Button>
      </header>

      {!collapsed ?
        <div className="px-4 py-3">
          {category.tasks.length === 0 ?
            <p className="mb-2 text-xs text-muted dark:text-white/45">Нет задач в категории</p>
          : <ul className="mb-3 space-y-0.5">
              {category.tasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  recordDate={recordDate}
                  categories={categories}
                  onPatch={(body) => onPatchTask(task.id, body)}
                  onDelete={() => onDeleteTask(task.id)}
                  onJournalSaved={onJournalSaved}
                />
              ))}
            </ul>
          }
          <div className="flex gap-2">
            <Input
              className="h-9 text-sm"
              placeholder="Добавить задачу…"
              value={taskDraft}
              onChange={(e) => onTaskDraftChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onAddTask()}
            />
            <Button type="button" size="sm" variant="outline" disabled={!taskDraft.trim()} onClick={onAddTask}>
              <Plus className="size-4" />
            </Button>
          </div>
        </div>
      : null}
    </section>
  );
}

function TaskRow({
  task,
  recordDate,
  categories,
  onPatch,
  onDelete,
  onJournalSaved,
}: {
  task: OpsTask;
  recordDate: string;
  categories: OpsCategory[];
  onPatch: (body: {
    status?: OpsTaskStatus;
    title?: string;
    categoryId?: string | null;
    checkType?: OpsTaskCheckType;
  }) => void;
  onDelete: () => void;
  onJournalSaved: () => void;
}) {
  const [showStatus, setShowStatus] = React.useState(false);
  const [showJournal, setShowJournal] = React.useState(false);
  const isDone = task.status === 'DONE';
  const checkType = task.checkType ?? 'GENERIC';
  const j = task.checkJournal;

  return (
    <li className="rounded-lg border border-transparent py-1 hover:border-stroke/60 dark:hover:border-white/[0.06]">
      <div className="group flex flex-wrap items-start gap-2 py-1.5 pl-1 pr-2">
        <Checkbox
          checked={isDone}
          onCheckedChange={(c) => onPatch({ status: c ? 'DONE' : 'PENDING' })}
          className="mt-0.5 shrink-0"
        />
        <div className="min-w-0 flex-1">
          <input
            className={`w-full border-0 bg-transparent text-sm outline-none dark:text-white/90 ${
              isDone ? 'text-muted line-through dark:text-white/40' : ''
            }`}
            defaultValue={task.title}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v && v !== task.title) onPatch({ title: v });
            }}
          />
          {j ?
            <div className="mt-0.5 text-[10px] text-muted dark:text-white/40">
              Журнал: {j.recorded}/{j.activeEmployees}
              {j.issues > 0 ? ` · проблем: ${j.issues}` : ''}
            </div>
          : null}
          {showStatus ?
            <div className="mt-1.5 flex flex-wrap gap-1">
              {(['DONE', 'NOT_DONE', 'PARTIAL', 'OVERDUE', 'NEEDS_ATTENTION'] as OpsTaskStatus[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onPatch({ status: s })}
                  className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                    task.status === s ? 'bg-accent/20' : 'bg-black/[0.04] dark:bg-white/[0.06]'
                  }`}
                >
                  {OPS_STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          : null}
        </div>
        <select
          className="max-w-[100px] rounded border border-stroke bg-transparent px-1 py-0.5 text-[10px] dark:border-white/10"
          value={checkType}
          onChange={(e) => onPatch({ checkType: e.target.value as OpsTaskCheckType })}
          title="Тип фиксации"
        >
          {(Object.keys(CHECK_TYPE_LABEL) as OpsTaskCheckType[]).map((k) => (
            <option key={k} value={k}>
              {CHECK_TYPE_LABEL[k]}
            </option>
          ))}
        </select>
        <select
          className="max-w-[120px] rounded border border-stroke bg-transparent px-1 py-0.5 text-[10px] dark:border-white/10"
          value={task.categoryId ?? ''}
          onChange={(e) => onPatch({ categoryId: e.target.value || null })}
          title="Категория"
        >
          <option value="">Без категории</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
        <Button
          type="button"
          variant={showJournal ? 'primary' : 'outline'}
          size="sm"
          className="h-7 text-[10px]"
          onClick={() => setShowJournal((v) => !v)}
        >
          Фиксация
        </Button>
        <button
          type="button"
          className="text-[10px] text-muted underline-offset-2 hover:underline dark:text-white/40"
          onClick={() => setShowStatus((v) => !v)}
        >
          {OPS_STATUS_LABELS[task.status]}
        </button>
        <button type="button" className="text-rose-500" onClick={onDelete}>
          <Trash2 className="size-3.5" />
        </button>
      </div>
      {showJournal ?
        <OpsTaskCheckPanel
          taskId={task.id}
          recordDate={recordDate}
          checkType={checkType}
          onSaved={onJournalSaved}
        />
      : null}
    </li>
  );
}
