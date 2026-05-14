import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { TaskDayScoreCell } from '@/components/tasks/TaskDayScoreCell';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { utcMondayIso } from '@/lib/date';
import { apiJson } from '@/lib/http';
import { ruEmployeeStatus } from '@/lib/format';
import { DAY_HEADER_CELL_CLASS, DAY_KEYS, DAY_LABEL_RU, DAY_MATRIX_CORNER_CLASS, nextStatus, WEEK_MATRIX_GRID_CLASS, type DayKey } from '@/lib/task-days';
import type { EmployeeStatus, EmployeeListItem, Task, UserRole } from '@/lib/types';
import { motion } from 'framer-motion';
import { LayoutGrid, List, Pencil, Trash2 } from 'lucide-react';

import { useAuth } from '@/context/auth';
import { canEditTaskDays, canManageTasks } from '@/lib/taskPermissions';

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

function statusTone(status: EmployeeStatus): BadgeTone {
  if (status === 'ACTIVE') return 'success';
  if (status === 'ON_LEAVE') return 'warning';
  return 'neutral';
}

function canWrite(role?: UserRole) {
  return role === 'ADMIN' || role === 'MANAGER';
}

export default function EmployeesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [q, setQ] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<'ALL' | EmployeeStatus>('ALL');
  const [sort, setSort] = React.useState<'nameAsc' | 'nameDesc' | 'createdAsc' | 'createdDesc'>('nameAsc');
  const dq = useDebouncedValue(q, 350);
  const [weekAnchor, setWeekAnchor] = React.useState(utcMondayIso());
  const [selected, setSelected] = React.useState<Record<string, boolean>>({});
  const [createOpen, setCreateOpen] = React.useState(false);
  const [newName, setNewName] = React.useState('');
  const [newPosition, setNewPosition] = React.useState('');

  const [editOpen, setEditOpen] = React.useState(false);
  const [editTaskId, setEditTaskId] = React.useState<string | null>(null);
  const [editTitle, setEditTitle] = React.useState('');
  const [editDescription, setEditDescription] = React.useState('');
  const [editTaskDate, setEditTaskDate] = React.useState(utcMondayIso());

  const queryString = React.useMemo(() => {
    const params = new URLSearchParams();
    if (dq.trim()) params.set('q', dq.trim());
    if (statusFilter !== 'ALL') params.set('status', statusFilter);
    params.set('sort', sort);
    params.set('weekAnchor', weekAnchor);
    const s = params.toString();
    return s ? `?${s}` : '';
  }, [dq, sort, statusFilter, weekAnchor]);

  const employees = useQuery({
    queryKey: ['employees', queryString],
    queryFn: () => apiJson<{ items: EmployeeListItem[] }>(`/employees${queryString}`),
  });

  const items = employees.data?.items ?? [];

  const boardTasks = useQueries({
    queries: items.map((employee) => ({
      queryKey: ['employee-tasks', employee.id],
      queryFn: () => apiJson<Task[]>(`/employees/${employee.id}/tasks`),
      enabled: items.length > 0,
    })),
  });

  const boardOverviews = useQueries({
    queries: items.map((employee) => ({
      queryKey: ['employee-overview', employee.id],
      queryFn: () => apiJson<EmployeeOverview>(`/analytics/employees/${employee.id}/overview`),
      enabled: items.length > 0,
    })),
  });

  const createEmployee = useMutation({
    mutationFn: async (payload: { name: string; position: string }) =>
      apiJson('/employees', {
        method: 'POST',
        body: JSON.stringify({ name: payload.name.trim(), position: payload.position.trim() }),
      }),
    onSuccess: async () => {
      toast.success('Сотрудник создан');
      setCreateOpen(false);
      setNewName('');
      setNewPosition('');
      await qc.invalidateQueries({ queryKey: ['employees'] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Не удалось создать'),
  });

  const submitNewEmployee = () => {
    const name = newName.trim();
    const position = newPosition.trim();
    if (name.length < 2 || position.length < 2) {
      toast.error('Имя и должность — минимум 2 символа (как на сервере).');
      return;
    }
    createEmployee.mutate({ name, position });
  };

  const removeEmployee = useMutation({
    mutationFn: async (id: string) => apiJson(`/employees/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      toast.success('Сотрудник удалён');
      await qc.invalidateQueries({ queryKey: ['employees'] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Нет доступа или ошибка удаления'),
  });

  const createTaskForEmployee = useMutation({
    mutationFn: (employeeId: string) =>
      apiJson(`/employees/${employeeId}/tasks`, {
        method: 'POST',
        body: JSON.stringify({
          title: 'Новая задача недели',
          description: 'Добавлено с оперативной доски',
          taskDate: weekAnchor,
          days: {},
        }),
      }),
    onSuccess: async () => {
      toast.success('Задача создана');
      await qc.invalidateQueries({ queryKey: ['employee-tasks'] });
      await qc.invalidateQueries({ queryKey: ['employees'] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Не удалось создать задачу'),
  });

  const patchTaskDay = useMutation({
    mutationFn: ({ taskId, day, current }: { taskId: string; day: DayKey; current: number }) =>
      apiJson(`/tasks/${taskId}`, {
        method: 'PATCH',
        body: JSON.stringify({ days: { [day]: nextStatus(current) } }),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['employee-tasks'] });
      await qc.invalidateQueries({ queryKey: ['employees'] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Не удалось сохранить балл'),
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
      await qc.invalidateQueries({ queryKey: ['employee-tasks'] });
      await qc.invalidateQueries({ queryKey: ['employees'] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Не удалось сохранить'),
  });

  const deleteTask = useMutation({
    mutationFn: (taskId: string) => apiJson(`/tasks/${taskId}`, { method: 'DELETE' }),
    onSuccess: async () => {
      toast.success('Задача удалена');
      await qc.invalidateQueries({ queryKey: ['employee-tasks'] });
      await qc.invalidateQueries({ queryKey: ['employees'] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Не удалось удалить задачу'),
  });

  const bulkStatus = useMutation({
    mutationFn: async ({ status }: { status: EmployeeStatus }) => {
      const ids = Object.entries(selected).filter(([, ok]) => ok).map(([id]) => id);
      if (!ids.length) throw new Error('Выберите сотрудников');
      return apiJson(`/employees/bulk-patch`, {
        method: 'POST',
        body: JSON.stringify({
          patches: ids.map((id) => ({
            employeeId: id,
            data: { status },
          })),
        }),
      });
    },
    onSuccess: async () => {
      toast.success('Статус обновлён');
      setSelected({});
      await qc.invalidateQueries({ queryKey: ['employees'] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Ошибка массового обновления'),
  });

  const anySelected = Object.values(selected).some(Boolean);

  const toggleSelected = (id: string, v: boolean) => {
    setSelected((prev) => ({ ...prev, [id]: v }));
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

  const table = (
    <div className="overflow-auto rounded-lg border border-stroke dark:border-white/[0.06]">
      <table className="min-w-[900px] w-full border-collapse">
        <thead className="text-left text-[11px] uppercase tracking-[0.14em] text-muted dark:text-white/55">
          <tr className="border-b border-stroke dark:border-white/10">
            {canWrite(user?.role) ?
              <th className="p-3">Выбор</th>
            : null}
            <th className="p-3">Сотрудник</th>
            <th className="p-3">Должность</th>
            <th className="p-3">Статус</th>
            <th className="p-3">Неделя KPI</th>
            <th className="p-3"></th>
          </tr>
        </thead>
        <tbody className="text-sm">
          {items.map((e) => (
            <tr key={e.id} className="border-b border-stroke last:border-transparent hover:bg-black/[0.02] dark:border-white/[0.06] dark:hover:bg-white/[0.03]">
              {canWrite(user?.role) ?
                <td className="w-24 p-3">
                  <Checkbox checked={selected[e.id] === true} onCheckedChange={(v) => toggleSelected(e.id, v === true)} />
                </td>
              : null}
              <td className="p-3 font-semibold text-zinc-900 dark:text-white">{e.name}</td>
              <td className="p-3 text-muted">{e.position}</td>
              <td className="p-3">
                <Badge tone={statusTone(e.status)}>{ruEmployeeStatus(e.status)}</Badge>
              </td>
              <td className="p-3 font-semibold">{(e.kpiWeeklyRounded ?? Math.round(e.kpiWeekly ?? 0)).toString()}%</td>
              <td className="p-3 text-right">
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link to={`/employees/${e.id}`}>Профиль</Link>
                  </Button>
                  {user?.role === 'ADMIN' ?
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-rose-600 dark:text-rose-200"
                      title="Удалить сотрудника"
                      aria-label={`Удалить сотрудника ${e.name}`}
                      onClick={() => {
                        if (!confirm('Удалить сотрудника? Это необратимо.')) return;
                        removeEmployee.mutate(e.id);
                      }}
                    >
                      <Trash2 className="size-4" />
                      <span className="ml-1.5 hidden min-[1000px]:inline">Удалить</span>
                    </Button>
                  : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const cards = (
    <div className="grid gap-4 lg:grid-cols-3">
      {items.map((e) => (
        <motion.div key={e.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="relative">
          <Card>
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="text-lg font-semibold text-zinc-900 dark:text-white">{e.name}</div>
                <div className="text-sm text-muted">{e.position}</div>
              </div>
              {canWrite(user?.role) ?
                <Checkbox checked={selected[e.id] === true} onCheckedChange={(v) => toggleSelected(e.id, v === true)} aria-label={`Выбор ${e.name}`} />
              : null}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Badge tone={statusTone(e.status)}>{ruEmployeeStatus(e.status)}</Badge>
              <Badge tone="neutral">Неделя:{` ${(e.kpiWeeklyRounded ?? Math.round(e.kpiWeekly ?? 0)).toString()}%`}</Badge>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <Button className="flex-1" asChild variant="outline">
                <Link to={`/employees/${e.id}`}>Детально</Link>
              </Button>
              {user?.role === 'ADMIN' ?
                <Button
                  variant="ghost"
                  className="text-rose-600 dark:text-rose-200"
                  onClick={() => {
                    if (!confirm('Удалить сотрудника?')) return;
                    removeEmployee.mutate(e.id);
                  }}
                >
                  Удалить
                </Button>
              : null}
            </div>
          </Card>
        </motion.div>
      ))}
      {employees.isFetching && (
        <>
          {[0, 1, 2].map((idx) => (
            <Skeleton key={idx} className="min-h-[196px]" />
          ))}
        </>
      )}
    </div>
  );

  const featuredPalette = [
    { border: 'border-cyan-400/45', bg: 'bg-cyan-500/12', dot: 'bg-cyan-400' },
    { border: 'border-violet-400/45', bg: 'bg-violet-500/12', dot: 'bg-violet-400' },
    { border: 'border-emerald-400/45', bg: 'bg-emerald-500/12', dot: 'bg-emerald-400' },
    { border: 'border-amber-400/45', bg: 'bg-amber-500/12', dot: 'bg-amber-400' },
  ] as const;

  const employeesBoard = (
    <div className="space-y-6">
      <div className="text-sm text-muted dark:text-white/55">
        Все сотрудники из текущего списка (с учётом фильтров) — по одному на строку, на всю ширину: задачи, ПН–ВС, аналитика.
      </div>
      {items.map((employee, idx) => {
        const taskQuery = boardTasks[idx];
        const overviewQuery = boardOverviews[idx];
        const taskList = taskQuery?.data ?? [];
        const palette = featuredPalette[idx % featuredPalette.length];
        const canEditThis = canEditTaskDays(user, employee.id);
        const canMeta = canManageTasks(user);
        const taskMutating = patchTaskDay.isPending || updateTaskMeta.isPending || deleteTask.isPending;

        return (
          <div
            key={employee.id}
            className={`w-full rounded-xl border p-4 sm:p-5 ${palette.border} ${palette.bg}`}
          >
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`size-2.5 shrink-0 rounded-full ${palette.dot}`} />
                      <div className="text-xl font-bold leading-tight tracking-tight text-zinc-900 dark:text-white sm:text-2xl">
                        {employee.name}
                      </div>
                    </div>
                    <div className="mt-1 text-sm text-muted dark:text-white/55">{employee.position}</div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge tone={statusTone(employee.status)}>{ruEmployeeStatus(employee.status)}</Badge>
                      <Badge tone="neutral">
                        KPI: {(employee.kpiWeeklyRounded ?? Math.round(employee.kpiWeekly ?? 0)).toFixed(0)}%
                      </Badge>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap justify-end gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link to={`/employees/${employee.id}`}>Профиль</Link>
                    </Button>
                    {user?.role === 'ADMIN' ?
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-rose-600 dark:text-rose-200"
                        title="Удалить сотрудника"
                        aria-label={`Удалить сотрудника ${employee.name}`}
                        onClick={() => {
                          if (!confirm('Удалить сотрудника? Это необратимо.')) return;
                          removeEmployee.mutate(employee.id);
                        }}
                      >
                        <Trash2 className="size-4" />
                        <span className="ml-1.5 hidden sm:inline">Удалить</span>
                      </Button>
                    : null}
                  </div>
                </div>

                <div className="min-w-0 overflow-x-auto">
                  {taskQuery?.isLoading ? (
                    <Skeleton className="h-[120px] w-full min-w-[20rem]" />
                  ) : (
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

                      {taskList.length === 0 ? (
                        <div className="col-span-8 rounded-lg border border-dashed border-stroke/80 py-6 text-center text-sm text-muted dark:border-white/15 dark:text-white/55">
                          Нет задач.{' '}
                          {canEditThis ? (
                            <button
                              type="button"
                              onClick={() => createTaskForEmployee.mutate(employee.id)}
                              className="font-semibold text-accent"
                            >
                              Создать первую
                            </button>
                          ) : (
                            'У сотрудника ещё не заведены задачи.'
                          )}
                        </div>
                      ) : (
                        taskList.map((t) => (
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
                            {DAY_KEYS.map((day, dayIdx) => {
                              const value = Number((t as unknown as Record<string, unknown>)[day] ?? 0);
                              return (
                                <div key={`${t.id}-${day}`} className="flex items-center justify-center">
                                  <TaskDayScoreCell
                                    weekdayShort={DAY_LABEL_RU[dayIdx]}
                                    value={value}
                                    compact
                                    scoreOnly
                                    matrix
                                    disabled={!canEditThis || taskMutating}
                                    onStep={() => patchTaskDay.mutate({ taskId: t.id, day, current: value })}
                                  />
                                </div>
                              );
                            })}
                          </React.Fragment>
                        ))
                      )}
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-stroke/80 bg-black/14 p-3 text-xs dark:border-white/10 dark:bg-black/35">
                  <div className="mb-2 text-[10px] uppercase tracking-[0.15em] text-muted dark:text-white/55">Аналитика</div>
                  {overviewQuery?.isLoading ? (
                    <Skeleton className="h-8" />
                  ) : overviewQuery?.data ? (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <div className="rounded-lg border border-stroke/60 bg-white/45 px-2 py-1.5 dark:border-white/10 dark:bg-white/5">
                        Серия: <span className="font-semibold">{overviewQuery.data.streakWeeks}</span>
                      </div>
                      <div className="rounded-lg border border-stroke/60 bg-white/45 px-2 py-1.5 dark:border-white/10 dark:bg-white/5">
                        Месяц: <span className="font-semibold">{overviewQuery.data.monthlyEfficiency.toFixed(1)}%</span>
                      </div>
                      <div className="rounded-lg border border-emerald-400/35 bg-emerald-500/10 px-2 py-1.5">
                        Рост: <span className="font-semibold">{overviewQuery.data.growthPercent.toFixed(1)}%</span>
                      </div>
                      <div className="rounded-lg border border-rose-400/35 bg-rose-500/10 px-2 py-1.5">
                        Спад: <span className="font-semibold">{overviewQuery.data.declinePercent.toFixed(1)}%</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-muted dark:text-white/55">Аналитика пока недоступна</div>
                  )}
                </div>
              </div>
            </div>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title="Сотрудники"
        description="Доска: все отфильтрованные сотрудники списком вниз, у каждого полный горизонтальный блок. Карточки и таблица — те же данные."
        actions={
          <>
            {canWrite(user?.role) ?
              <Button type="button" onClick={() => setCreateOpen(true)} disabled={createEmployee.isPending}>
                Новый сотрудник
              </Button>
            : null}
            <Button variant="outline" onClick={() => setWeekAnchor(utcMondayIso())}>
              Сбросить неделю
            </Button>
          </>
        }
      />

      <Card>
        <CardHeader title="Фильтры и поиск" description="Столбцы KPI синхронизированы с бэкенд-логикой и понедельничным якорём." />

        <div className="grid gap-4 lg:grid-cols-[1.35fr_repeat(4,minmax(0,1fr))]">
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-[0.14em] text-muted dark:text-white/55">Поиск имени</div>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Елена, Олег, отдел …" />
          </div>

          <div className="space-y-2">
            <div className="text-xs uppercase tracking-[0.14em] text-muted dark:text-white/55">Статус</div>
            <select
              className="h-9 w-full rounded-lg border border-stroke bg-[hsl(var(--panel))] px-3 text-[13px] outline-none transition focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring-focus)/0.35)] dark:border-white/[0.1] dark:bg-[hsl(var(--elevated))] dark:text-white"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            >
              <option value="ALL">Все статусы</option>
              <option value="ACTIVE">Активен</option>
              <option value="INACTIVE">Неактивен</option>
              <option value="ON_LEAVE">В отпуске</option>
            </select>
          </div>

          <div className="space-y-2">
            <div className="text-xs uppercase tracking-[0.14em] text-muted dark:text-white/55">Сортировка</div>
            <select
              className="h-9 w-full rounded-lg border border-stroke bg-[hsl(var(--panel))] px-3 text-[13px] outline-none transition focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring-focus)/0.35)] dark:border-white/[0.1] dark:bg-[hsl(var(--elevated))] dark:text-white"
              value={sort}
              onChange={(e) => setSort(e.target.value as typeof sort)}
            >
              <option value="nameAsc">Имя А→Я</option>
              <option value="nameDesc">Имя Я→А</option>
              <option value="createdAsc">Создан: старые</option>
              <option value="createdDesc">Создан: новые</option>
            </select>
          </div>

          <div className="space-y-2 lg:col-span-2">
            <div className="text-xs uppercase tracking-[0.14em] text-muted dark:text-white/55">Неделя (анкера)</div>
            <Input type="date" value={weekAnchor} onChange={(e) => setWeekAnchor(e.target.value)} />
          </div>
        </div>

        {canWrite(user?.role) ?
          <div className="mt-5 flex flex-wrap items-center gap-2 rounded-lg border border-stroke bg-black/[0.02] p-3 dark:border-white/[0.06] dark:bg-white/[0.03]">
            <div className="text-sm font-semibold text-zinc-900 dark:text-white">Быстрое управление статусами</div>
            <div className="ml-auto flex flex-wrap gap-2">
              <Button disabled={!anySelected || bulkStatus.isPending} variant="outline" onClick={() => bulkStatus.mutate({ status: 'ACTIVE' })}>
                Активны
              </Button>
              <Button disabled={!anySelected || bulkStatus.isPending} variant="outline" onClick={() => bulkStatus.mutate({ status: 'ON_LEAVE' })}>
                В отпуске
              </Button>
              <Button disabled={!anySelected || bulkStatus.isPending} variant="outline" onClick={() => bulkStatus.mutate({ status: 'INACTIVE' })}>
                Неактивны
              </Button>
            </div>
          </div>
        : null}

        <div className="mt-6">
          {employees.isLoading ?
            <Skeleton className="h-[440px]" />
          : <>
              <Tabs defaultValue="board">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <TabsList>
                    <TabsTrigger value="board" className="gap-2">
                      Доска
                    </TabsTrigger>
                    <TabsTrigger value="cards" className="gap-2">
                      <LayoutGrid className="size-4" aria-hidden /> Карты
                    </TabsTrigger>
                    <TabsTrigger value="table" className="gap-2">
                      <List className="size-4" aria-hidden /> Таблица
                    </TabsTrigger>
                  </TabsList>

                  <div className="text-xs text-muted dark:text-white/55">
                    Недельный KPI.{` В списке: ${items.length}`}
                    {user?.role === 'ADMIN' ?
                      ' Удаление — кнопка с корзиной у каждого сотрудника (здесь, в картах и в таблице).'
                    : null}
                  </div>
                </div>

                <TabsContent value="board">{employeesBoard}</TabsContent>
                <TabsContent value="cards">{cards}</TabsContent>
                <TabsContent value="table">{table}</TabsContent>
              </Tabs>

              {!items.length ?
                <div className="rounded-xl border border-dashed border-stroke py-14 text-center text-[13px] text-muted dark:border-white/[0.08] dark:text-white/45">
                  Пока что пусто. Создайте сотрудника или ослабьте фильтры.
                </div>
              : null}
            </>
          }
        </div>
      </Card>

      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) setEditTaskId(null);
        }}
      >
        <DialogContent>
          <DialogTitle className="text-base font-semibold text-zinc-900 dark:text-white">Изменить задачу</DialogTitle>
          <div className="mt-4 grid gap-3">
            <label className="grid gap-1.5 text-[13px] font-medium text-zinc-900 dark:text-white/90">
              Название
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
            </label>
            <label className="grid gap-1.5 text-[13px] font-medium text-zinc-900 dark:text-white/90">
              Описание
              <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={3} />
            </label>
            <label className="grid gap-1.5 text-[13px] font-medium text-zinc-900 dark:text-white/90">
              Дата (якорь недели)
              <Input type="date" value={editTaskDate} onChange={(e) => setEditTaskDate(e.target.value)} />
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

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) {
            setNewName('');
            setNewPosition('');
          }
        }}
      >
        <DialogContent>
          <DialogTitle className="text-base font-semibold text-zinc-900 dark:text-white">Новый сотрудник</DialogTitle>
          <p className="mt-1 text-[13px] text-muted dark:text-white/50">Минимум 2 символа в имени и должности — требование API.</p>
          <div className="mt-4 grid gap-3">
            <label className="grid gap-1.5 text-[13px] font-medium text-zinc-900 dark:text-white/90">
              Имя
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Например, Анна Смирнова"
                autoComplete="off"
              />
            </label>
            <label className="grid gap-1.5 text-[13px] font-medium text-zinc-900 dark:text-white/90">
              Должность
              <Input
                value={newPosition}
                onChange={(e) => setNewPosition(e.target.value)}
                placeholder="Например, Аналитик"
                autoComplete="off"
              />
            </label>
            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Отмена
              </Button>
              <Button type="button" disabled={createEmployee.isPending} onClick={submitNewEmployee}>
                {createEmployee.isPending ? 'Сохранение…' : 'Создать'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
