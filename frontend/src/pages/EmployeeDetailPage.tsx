import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Trash2 } from 'lucide-react';
import * as React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';

import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/context/auth';
import { utcMondayIso } from '@/lib/date';
import { ruEmployeeStatus } from '@/lib/format';
import { apiJson } from '@/lib/http';
import { canEditTaskDays } from '@/lib/taskPermissions';
import { DAY_KEYS, DAY_LABEL_RU, nextStatus, type DayKey } from '@/lib/task-days';
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

  const createTask = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error('Пустой ID');
      return apiJson(`/employees/${id}/tasks`, {
        method: 'POST',
        body: JSON.stringify({
          title,
          description,
          taskDate: taskAnchor,
          days: {},
        }),
      });
    },
    onSuccess: async () => {
      toast.success('Задача добавлена');
      setDialogOpen(false);
      setTitle('Фокус команды на неделе');
      setDescription('');
      await qc.invalidateQueries({ queryKey: ['employee-tasks', id] });
      await qc.invalidateQueries({ queryKey: ['employees'] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Не создано'),
  });

  const onToggleDay = (taskId: string, day: DayKey, currentRaw: unknown) => {
    if (!id || !canEditTaskDays(user, id)) return;
    const current = typeof currentRaw === 'number' ? currentRaw : Number(currentRaw ?? 0);
    const next = nextStatus(current);
    patchTask.mutate({ taskId, days: { [day]: next } });
  };

  if (!id) return null;

  const items = tasks.data ?? [];

  return (
    <div className="space-y-8">
      <div>
        <Link className="text-[13px] font-medium text-accent hover:opacity-90" to="/employees">
          ← Все сотрудники
        </Link>
        <div className="mt-4">
          {employee.isLoading ?
            <Skeleton className="h-24 w-full max-w-lg" />
          : (
            <PageHeader
              title={employee.data?.name ?? 'Сотрудник'}
              description={
                <span className="flex flex-wrap items-center gap-2">
                  {employee.data?.position}
                  {employee.data?.status ?
                    <Badge tone={employee.data.status === 'ACTIVE' ? 'success' : 'warning'}>{ruEmployeeStatus(employee.data.status)}</Badge>
                  : null}
                </span>
              }
              actions={
                <>
                  {canEditTaskDays(user, id) ?
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
                      aria-label={`Удалить сотрудника ${employee.data?.name ?? ''}`}
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
                </>
              }
              className="border-0 pb-0"
            />
          )}
        </div>
      </div>

      <Card>
        <CardHeader title="Фокус показателей" description="Серии, месяцы и недельное исполнение в одном взгляде." />

        {overview.isLoading ?
          <Skeleton className="h-[120px]" />
        : (
          overview.data && (
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
              <Metric label="Серия недель" value={`${overview.data.streakWeeks}`} />
              <Metric label="Рост" value={`${Number(overview.data.growthPercent).toFixed(2)}%`} />
              <Metric label="Спад" value={`${Number(overview.data.declinePercent).toFixed(2)}%`} />
              <Metric accent label="Месяц" value={`${Number(overview.data.monthlyEfficiency).toFixed(2)}%`} />
              <Metric accent label="Период" value={`${Number(overview.data.periodEfficiency).toFixed(2)}%`} />
            </div>
          )
        )}
      </Card>

      <Card>
        <CardHeader
          title="Матрица недели задач"
          description="Цикл 0 • 1 • 2 синхронно с KPI. Изменение мгновенно уходит на API."
        />

        {!tasks.data ?
          <div className="space-y-2">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        : items.length === 0 ?
          <EmptyTasks employeeName={employee.data?.name} canEdit={canEditTaskDays(user, id)} open={() => setDialogOpen(true)} />
        : items.map((t) => (
            <motion.div layout key={t.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="mb-6 rounded-xl border border-stroke bg-[hsl(var(--panel))] p-4 dark:border-white/[0.06]">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-[220px] flex-1">
                    <div className="text-lg font-semibold text-zinc-900 dark:text-white">{t.title}</div>
                    {t.description?.trim() ?
                      <div className="mt-2 text-sm text-muted dark:text-white/55">{t.description}</div>
                    : null}
                    <div className="mt-3 text-xs uppercase tracking-[0.14em] text-muted dark:text-white/45">
                      Неделя:{` ${formatTaskDate(t.taskDate)}`}
                    </div>
                  </div>

                  <div className="w-full xl:w-auto">
                    <div className="grid grid-cols-7 gap-2">
                      {DAY_KEYS.map((day, idx) => {
                        const value = Number((t as never)[day] ?? 0);
                        return (
                          <button
                            key={day}
                            type="button"
                            disabled={!canEditTaskDays(user, id) || patchTask.isPending}
                            onClick={() => onToggleDay(t.id, day, value)}
                            className={cnCell(value, canEditTaskDays(user, id))}
                            title={`${DAY_LABEL_RU[idx]} — ${labelForStatus(value)}`}
                          >
                            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] opacity-70">{DAY_LABEL_RU[idx]}</div>
                            <div className="mt-1 text-lg font-semibold">{symbolForStatus(value)}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))
        }
      </Card>

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
            <Button type="button" disabled={createTask.isPending} onClick={() => createTask.mutate()}>
              Создать
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Metric({ label, value, accent, muted }: { label: string; value: string; accent?: boolean; muted?: boolean }) {
  return (
    <div className="rounded-[18px] border border-stroke bg-white/65 p-4 dark:border-white/10 dark:bg-white/8">
      <div className="text-[11px] uppercase tracking-[0.16em] text-muted dark:text-white/45">{label}</div>
      <div
        className={`mt-2 text-lg font-semibold leading-tight ${accent ? 'text-accent' : ''} ${muted ? 'text-sm text-muted dark:text-white/55' : 'text-zinc-900 dark:text-white'}`}
      >
        {value}
      </div>
    </div>
  );
}

function cnCell(value: number, editable: boolean) {
  const base =
    'relative overflow-hidden rounded-2xl border px-2 py-3 text-left text-[11px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60';
  const disabled = editable ? 'hover:-translate-y-0.5' : 'opacity-70';
  if (value >= 2) return `${base} ${disabled} border-accent/45 bg-accent/25 dark:bg-accent/25`;
  if (value >= 1) return `${base} ${disabled} border-emerald-300/65 bg-emerald-400/20 dark:bg-emerald-300/21`;
  return `${base} ${disabled} border-stroke bg-black/14 text-muted dark:border-white/10 dark:bg-black/52 dark:text-white/55`;
}

function labelForStatus(v: number) {
  if (v >= 2) return 'перевыполнено';
  if (v >= 1) return 'базовое выполнение';
  return 'не выполнено';
}

function symbolForStatus(v: number) {
  if (v >= 2) return 'P';
  if (v >= 1) return '+';
  return '−';
}

function EmptyTasks({ employeeName, canEdit, open }: { employeeName?: string; canEdit: boolean; open: () => void }) {
  return (
    <div className="rounded-[26px] border border-dashed border-stroke px-6 py-10 text-center dark:border-white/14">
      <div className="text-lg font-semibold text-zinc-900 dark:text-white">Нет задач</div>
      <div className="mx-auto mt-2 max-w-md text-sm text-muted dark:text-white/56">
        {employeeName ?? 'Специалист'} еще не добавлен в задачный цикл. Создайте первую задачу, чтобы активировать недельную матрицу.
      </div>
      {canEdit ?
        <Button className="mt-6" type="button" onClick={open}>
          Новая задача
        </Button>
      : null}
    </div>
  );
}
