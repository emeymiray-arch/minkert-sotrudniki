import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Trash2 } from 'lucide-react';
import * as React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { TaskDayScoreCell } from '@/components/tasks/TaskDayScoreCell';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/context/auth';
import { utcMondayIso } from '@/lib/date';
import { ruEmployeeStatus } from '@/lib/format';
import { apiJson } from '@/lib/http';
import { canEditTaskDays, canManageTasks } from '@/lib/taskPermissions';
import { DAY_HEADER_CELL_CLASS, DAY_KEYS, DAY_LABEL_RU, DAY_MATRIX_CORNER_CLASS, nextStatus, WEEK_MATRIX_GRID_CLASS, type DayKey } from '@/lib/task-days';
import type { Employee, Task } from '@/lib/types';

type EmployeeOverview = {
  streakWeeks: number;
  growthPercent: number;
  declinePercent: number;
  monthlyEfficiency: number;
  periodEfficiency: number;
};

function formatTaskDate(raw: unknown) {
  if (typeof raw === 'string') return raw.slice(0, 10);
  try {
    return new Date(raw as Date).toISOString().slice(0, 10);
  } catch {
    return String(raw);
  }
}

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [title, setTitle] = React.useState('Фокус команды на неделе');
  const [description, setDescription] = React.useState('');
  const [taskAnchor, setTaskAnchor] = React.useState(utcMondayIso());

  const [editOpen, setEditOpen] = React.useState(false);
  const [editTaskId, setEditTaskId] = React.useState<string | null>(null);
  const [editTitle, setEditTitle] = React.useState('');
  const [editDescription, setEditDescription] = React.useState('');
  const [editTaskDate, setEditTaskDate] = React.useState(utcMondayIso());

  const employee = useQuery({
    enabled: Boolean(id),
    queryKey: ['employee', id],
    queryFn: () => apiJson<Employee>(`/employees/${id}`),
  });

  const tasks = useQuery({
    enabled: Boolean(id),
    queryKey: ['employee-tasks', id],
    queryFn: () => apiJson<Task[]>(`/employees/${id}/tasks`),
  });

  const overview = useQuery({
    enabled: Boolean(id),
    queryKey: ['employee-overview', id],
    queryFn: () => apiJson<EmployeeOverview>(`/analytics/employees/${id}/overview`),
  });

  const patchTask = useMutation({
    mutationFn: async (args: { taskId: string; days: Partial<Record<DayKey, number>> }) =>
      apiJson<Task>(`/tasks/${args.taskId}`, {
        method: 'PATCH',
        body: JSON.stringify({ days: args.days }),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['employee-tasks', id] });
      await qc.invalidateQueries({ queryKey: ['employees'] });
      toast.success('Сохранено', { duration: 900 });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Ошибка сохранения'),
  });

  const removeEmployee = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error('Пустой ID');
      return apiJson(`/employees/${id}`, { method: 'DELETE' });
    },
    onSuccess: async () => {
      toast.success('Сотрудник удалён');
      await qc.invalidateQueries({ queryKey: ['employees'] });
      navigate('/employees', { replace: true });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Нет доступа или ошибка удаления'),
  });

  const updateTaskMeta = useMutation({
    mutationFn: async (payload: { taskId: string; title: string; description: string; taskDate: string }) =>
      apiJson<Task>(`/tasks/${payload.taskId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: payload.title.trim(),
          description: payload.description.trim(),
          taskDate: payload.taskDate,
        }),
      }),
    onSuccess: async () => {
      toast.success('Задача обновлена');
      setEditOpen(false);
      setEditTaskId(null);
      await qc.invalidateQueries({ queryKey: ['employee-tasks', id] });
      await qc.invalidateQueries({ queryKey: ['employees'] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Не удалось сохранить'),
  });

  const deleteTask = useMutation({
    mutationFn: async (taskId: string) => apiJson(`/tasks/${taskId}`, { method: 'DELETE' }),
    onSuccess: async () => {
      toast.success('Задача удалена');
      await qc.invalidateQueries({ queryKey: ['employee-tasks', id] });
      await qc.invalidateQueries({ queryKey: ['employees'] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Не удалось удалить задачу'),
  });

  const createTask = useMutation({
    mutationFn: async (opts?: { keepOpen?: boolean }) => {
      if (!id) throw new Error('Пустой ID');
      await apiJson<Task>(`/employees/${id}/tasks`, {
        method: 'POST',
        body: JSON.stringify({
          title,
          description,
          taskDate: taskAnchor,
          days: {},
        }),
      });
      return { keepOpen: Boolean(opts?.keepOpen) };
    },
    onSuccess: async (result) => {
      if (result.keepOpen) {
        toast.success('Задача добавлена — можно ввести следующую');
      } else {
        toast.success('Задача добавлена');
        setDialogOpen(false);
      }
      setTitle('Фокус команды на неделе');
      setDescription('');
      await qc.invalidateQueries({ queryKey: ['employee-tasks', id] });
      await qc.invalidateQueries({ queryKey: ['employees'] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Не создано'),
  });

  const diaryTokenMutation = useMutation({
    mutationFn: () => {
      if (!id) throw new Error('Пустой ID');
      return apiJson<{ token: string; path: string }>(`/employees/${id}/diary-token`, { method: 'POST' });
    },
    onSuccess: async () => {
      toast.success('Ссылка на дневник готова');
      await qc.invalidateQueries({ queryKey: ['employee', id] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Не удалось выдать ссылку'),
  });

  const onStepDay = (taskId: string, day: DayKey, currentRaw: unknown) => {
    if (!id || !canEditTaskDays(user, id)) return;
    const current = typeof currentRaw === 'number' ? currentRaw : Number(currentRaw ?? 0);
    const cur = Math.min(2, Math.max(0, Math.round(Number(current)))) as 0 | 1 | 2;
    const next = nextStatus(cur);
    patchTask.mutate({ taskId, days: { [day]: next } });
  };

  if (!id) return null;

  const items = tasks.data ?? [];
  const emp = employee.data;
  const canEdit = canEditTaskDays(user, id);
  const canMeta = canManageTasks(user);

  const copyDiaryLink = async (token: string) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/d/${token}`);
      toast.success('Ссылка скопирована');
    } catch {
      toast.error('Не удалось скопировать');
    }
  };

  const openEditTask = (t: Task) => {
    setEditTaskId(t.id);
    setEditTitle(t.title);
    setEditDescription(t.description ?? '');
    setEditTaskDate(formatTaskDate(t.taskDate));
    setEditOpen(true);
  };

  const submitEditTask = () => {
    if (!editTaskId) return;
    const t = editTitle.trim();
    if (t.length < 1) {
      toast.error('Укажите название задачи');
      return;
    }
    updateTaskMeta.mutate({
      taskId: editTaskId,
      title: t,
      description: editDescription,
      taskDate: editTaskDate,
    });
  };

  const submitNewTask = (keepOpen: boolean) => {
    if (title.trim().length < 1) {
      toast.error('Укажите название задачи');
      return;
    }
    createTask.mutate({ keepOpen });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link className="text-[13px] font-medium text-accent hover:opacity-90" to="/employees">
          ← Все сотрудники
        </Link>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {canEdit ?
            <Button type="button" onClick={() => setDialogOpen(true)}>
              Новая задача
            </Button>
          : null}
          {user?.role === 'ADMIN' ?
            <Button
              type="button"
              variant="ghost"
              className="text-rose-600 dark:text-rose-200"
              disabled={removeEmployee.isPending}
              title="Удалить сотрудника"
              aria-label={`Удалить сотрудника ${emp?.name ?? ''}`}
              onClick={() => {
                if (!confirm('Удалить сотрудника? Это необратимо.')) return;
                removeEmployee.mutate();
              }}
            >
              <Trash2 className="mr-1.5 size-4" aria-hidden />
              Удалить
            </Button>
          : null}
          <Button variant="outline" asChild>
            <Link to="/analytics">Аналитика</Link>
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        <Card className="min-w-0 overflow-hidden">
          <CardHeader
            title="Неделя и баллы"
            description="Сверху — сотрудник; ниже таблица: слева задачи, сверху ПН–ВС. Клик по ячейке: 0 → 1 → 2. Задач у сотрудника может быть сколько угодно: каждый раз «Новая задача» добавляет ещё одну строку в матрицу."
          />

          {!tasks.data ?
            <div className="space-y-2 p-4 pt-0">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          : items.length === 0 ?
            <div className="space-y-4 px-4 pb-6 pt-0">
              <div className="border-b border-stroke pb-4 dark:border-white/10">
                {employee.isLoading ?
                  <Skeleton className="h-10 w-48" />
                : (
                  <>
                    <div className="text-2xl font-bold leading-tight tracking-tight text-zinc-900 dark:text-white sm:text-3xl">
                      {emp?.name ?? 'Сотрудник'}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted dark:text-white/55">
                      <span>{emp?.position}</span>
                      {emp?.status ?
                        <Badge tone={emp.status === 'ACTIVE' ? 'success' : 'warning'}>{ruEmployeeStatus(emp.status)}</Badge>
                      : null}
                    </div>
                  </>
                )}
              </div>
              <EmptyTasks employeeName={emp?.name} canEdit={canEdit} open={() => setDialogOpen(true)} />
            </div>
          : (
            <>
              <div className="border-b border-stroke px-4 pb-4 dark:border-white/10">
                {employee.isLoading ?
                  <Skeleton className="h-10 w-48" />
                : (
                  <>
                    <div className="text-2xl font-bold leading-tight tracking-tight text-zinc-900 dark:text-white sm:text-3xl">
                      {emp?.name ?? 'Сотрудник'}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted dark:text-white/55">
                      <span>{emp?.position}</span>
                      {emp?.status ?
                        <Badge tone={emp.status === 'ACTIVE' ? 'success' : 'warning'}>{ruEmployeeStatus(emp.status)}</Badge>
                      : null}
                    </div>
                  </>
                )}
              </div>
              <div className="overflow-x-auto px-4 pb-6 pt-4">
                <div className={WEEK_MATRIX_GRID_CLASS}>
                  <div className={DAY_MATRIX_CORNER_CLASS}>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted dark:text-white/45">
                      Задачи
                    </span>
                  </div>
                  {DAY_LABEL_RU.map((label) => (
                    <div key={label} className={DAY_HEADER_CELL_CLASS}>
                      {label}
                    </div>
                  ))}

                  {items.map((t) => (
                    <React.Fragment key={t.id}>
                      <div className="min-w-0 rounded-lg border border-stroke/60 bg-black/[0.02] px-3 py-2 dark:border-white/[0.08] dark:bg-white/[0.03]">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="text-[15px] font-semibold leading-snug text-zinc-900 dark:text-white">{t.title}</div>
                            {t.description?.trim() ?
                              <div className="mt-1 text-[13px] leading-relaxed text-muted dark:text-white/50">{t.description}</div>
                            : null}
                            <div className="mt-2 text-[11px] uppercase tracking-[0.12em] text-muted dark:text-white/40">
                              Неделя:{` ${formatTaskDate(t.taskDate)}`}
                            </div>
                          </div>
                          {canMeta ?
                            <div className="flex shrink-0 gap-1">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 px-2"
                                title="Изменить задачу"
                                aria-label={`Изменить задачу ${t.title}`}
                                onClick={() => openEditTask(t)}
                              >
                                <Pencil className="size-3.5" aria-hidden />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2 text-rose-600 dark:text-rose-200"
                                disabled={deleteTask.isPending}
                                title="Удалить задачу"
                                aria-label={`Удалить задачу ${t.title}`}
                                onClick={() => {
                                  if (!confirm('Удалить эту задачу? Отметки по дням будут потеряны.')) return;
                                  deleteTask.mutate(t.id);
                                }}
                              >
                                <Trash2 className="size-3.5" aria-hidden />
                              </Button>
                            </div>
                          : null}
                        </div>
                      </div>
                      {DAY_KEYS.map((day, idx) => {
                        const value = Number((t as never)[day] ?? 0);
                        return (
                          <div key={`${t.id}-${day}`} className="flex items-center justify-center">
                            <TaskDayScoreCell
                              weekdayShort={DAY_LABEL_RU[idx]}
                              value={value}
                              compact
                              scoreOnly
                              matrix
                              disabled={!canEdit || patchTask.isPending || updateTaskMeta.isPending || deleteTask.isPending}
                              onStep={() => onStepDay(t.id, day, value)}
                            />
                          </div>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </div>
                {canEdit ?
                  <div className="flex flex-wrap justify-center gap-2 border-t border-stroke/60 px-4 pb-6 pt-4 dark:border-white/10">
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(true)}>
                      Добавить ещё задачу
                    </Button>
                  </div>
                : null}
              </div>
            </>
          )}
        </Card>

        <Card className="min-w-0">
          <CardHeader title="Аналитика" description="Показатели по сотруднику — под таблицей недели." />
          {overview.isLoading ?
            <Skeleton className="mx-4 mb-6 h-[200px]" />
          : overview.data ?
            <div className="grid gap-3 px-4 pb-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
              <Metric label="Серия недель" value={`${overview.data.streakWeeks}`} />
              <Metric label="Рост" value={`${Number(overview.data.growthPercent).toFixed(2)}%`} />
              <Metric label="Спад" value={`${Number(overview.data.declinePercent).toFixed(2)}%`} />
              <Metric accent label="Месяц" value={`${Number(overview.data.monthlyEfficiency).toFixed(2)}%`} />
              <Metric accent label="Период" value={`${Number(overview.data.periodEfficiency).toFixed(2)}%`} />
            </div>
          : null}
        </Card>

        <Card className="min-w-0 overflow-hidden">
          <CardHeader
            title="Ссылка для сотрудника"
            description="Отправьте ссылку на дневник: сотрудник увидит ваши задачи из таблицы «Неделя и баллы» и отметит выполнение за выбранный день. Отметки сразу видны вам в таблице выше."
          />
          <div className="space-y-4 px-4 pb-6">
            {canMeta ?
              <div className="rounded-xl border border-stroke bg-black/[0.02] p-3 dark:border-white/10 dark:bg-white/[0.03]">
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted dark:text-white/45">
                  Ссылка для сотрудника
                </div>
                {employee.data?.diaryToken ?
                  <div className="mt-2 space-y-2">
                    <Input
                      readOnly
                      className="font-mono text-[12px] sm:text-[13px]"
                      value={`${typeof window !== 'undefined' ? window.location.origin : ''}/d/${employee.data.diaryToken}`}
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => void copyDiaryLink(employee.data!.diaryToken!)}>
                        Копировать ссылку
                      </Button>
                      <Button type="button" variant="ghost" size="sm" disabled={diaryTokenMutation.isPending} onClick={() => diaryTokenMutation.mutate()}>
                        Новая ссылка
                      </Button>
                    </div>
                    <p className="text-[11px] text-muted dark:text-white/45">«Новая ссылка» отключает предыдущую.</p>
                  </div>
                : (
                  <Button type="button" className="mt-2" size="sm" disabled={diaryTokenMutation.isPending} onClick={() => diaryTokenMutation.mutate()}>
                    Создать ссылку для сотрудника
                  </Button>
                )}
              </div>
            : null}

          </div>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogTitle className="text-lg font-semibold text-zinc-900 dark:text-white">Новая задача</DialogTitle>
          <div className="mt-4 grid gap-3">
            <label className="text-sm font-semibold text-zinc-900 dark:text-white">
              Название
              <Input className="mt-2" value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label className="text-sm font-semibold text-zinc-900 dark:text-white">
              Описание
              <Textarea className="mt-2" value={description} onChange={(e) => setDescription(e.target.value)} />
            </label>
            <label className="text-sm font-semibold text-zinc-900 dark:text-white">
              Дата (якорь недели)
              <Input className="mt-2" type="date" value={taskAnchor} onChange={(e) => setTaskAnchor(e.target.value)} />
            </label>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
              <Button type="button" variant="outline" disabled={createTask.isPending} onClick={() => submitNewTask(true)}>
                {createTask.isPending ? 'Сохранение…' : 'Создать и добавить ещё'}
              </Button>
              <Button type="button" disabled={createTask.isPending} onClick={() => submitNewTask(false)}>
                {createTask.isPending ? 'Сохранение…' : 'Создать'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) setEditTaskId(null);
        }}
      >
        <DialogContent>
          <DialogTitle className="text-lg font-semibold text-zinc-900 dark:text-white">Изменить задачу</DialogTitle>
          <div className="mt-4 grid gap-3">
            <label className="text-sm font-semibold text-zinc-900 dark:text-white">
              Название
              <Input className="mt-2" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
            </label>
            <label className="text-sm font-semibold text-zinc-900 dark:text-white">
              Описание
              <Textarea className="mt-2" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
            </label>
            <label className="text-sm font-semibold text-zinc-900 dark:text-white">
              Дата (якорь недели)
              <Input className="mt-2" type="date" value={editTaskDate} onChange={(e) => setEditTaskDate(e.target.value)} />
            </label>
            <div className="flex flex-wrap justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                Отмена
              </Button>
              <Button type="button" disabled={updateTaskMeta.isPending} onClick={submitEditTask}>
                {updateTaskMeta.isPending ? 'Сохранение…' : 'Сохранить'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Metric({
  label,
  value,
  accent,
  muted,
  className,
}: {
  label: string;
  value: string;
  accent?: boolean;
  muted?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`rounded-[18px] border border-stroke bg-white/65 p-4 dark:border-white/10 dark:bg-white/8 ${className ?? ''}`}
    >
      <div className="text-[11px] uppercase tracking-[0.16em] text-muted dark:text-white/45">{label}</div>
      <div
        className={`mt-2 text-lg font-semibold leading-tight ${accent ? 'text-accent' : ''} ${muted ? 'text-sm text-muted dark:text-white/55' : 'text-zinc-900 dark:text-white'}`}
      >
        {value}
      </div>
    </div>
  );
}

function EmptyTasks({ employeeName, canEdit, open }: { employeeName?: string; canEdit: boolean; open: () => void }) {
  return (
    <div className="rounded-[26px] border border-dashed border-stroke px-6 py-10 text-center dark:border-white/14">
      <div className="text-lg font-semibold text-zinc-900 dark:text-white">Нет задач</div>
      <div className="mx-auto mt-2 max-w-md text-sm text-muted dark:text-white/56">
        {employeeName ?? 'Специалист'} еще не добавлен в задачный цикл. Создайте первую задачу, чтобы активировать недельную матрицу. Потом можно добавлять любое количество задач той же кнопкой.
      </div>
      {canEdit ?
        <Button className="mt-6" type="button" onClick={open}>
          Новая задача
        </Button>
      : null}
    </div>
  );
}
