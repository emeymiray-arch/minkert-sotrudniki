import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, MessageCircle, Trash2 } from 'lucide-react';
import * as React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';

import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { apiJson } from '@/lib/http';
import { ruEmployeeStatus } from '@/lib/format';
import type { Employee, EmployeeDailyLog, EmployeeStatus } from '@/lib/types';
import { utcMondayIso } from '@/lib/date';

function statusTone(status: EmployeeStatus): BadgeTone {
  if (status === 'ACTIVE') return 'success';
  if (status === 'ON_LEAVE') return 'warning';
  return 'neutral';
}

function kpiTone(v: number): BadgeTone {
  if (v >= 80) return 'success';
  if (v >= 60) return 'warning';
  return 'danger';
}

function whatsappHref(phone: string) {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return null;
  return `https://wa.me/${digits}`;
}

type LogItem = EmployeeDailyLog & { score: number };

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [name, setName] = React.useState('');
  const [position, setPosition] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [status, setStatus] = React.useState<EmployeeStatus>('ACTIVE');

  const employee = useQuery({
    enabled: Boolean(id),
    queryKey: ['employee', id],
    queryFn: () => apiJson<Employee>(`/employees/${id}`),
  });

  const weekAnchor = utcMondayIso();
  const logs = useQuery({
    enabled: Boolean(id),
    queryKey: ['employee-daily-logs', id, weekAnchor],
    queryFn: () => {
      const end = new Date(`${weekAnchor}T12:00:00Z`);
      end.setUTCDate(end.getUTCDate() + 6);
      const to = end.toISOString().slice(0, 10);
      return apiJson<{ items: LogItem[] }>(
        `/employees/${id}/daily-logs?from=${weekAnchor}&to=${to}`,
      );
    },
  });

  React.useEffect(() => {
    if (!employee.data) return;
    setName(employee.data.name);
    setPosition(employee.data.position);
    setPhone(employee.data.phone ?? '');
    setStatus(employee.data.status);
  }, [employee.data]);

  const saveProfile = useMutation({
    mutationFn: () =>
      apiJson(`/employees/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: name.trim(), position: position.trim(), phone: phone.trim(), status }),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['employee', id] });
      await qc.invalidateQueries({ queryKey: ['employees-daily-board'] });
      toast.success('Профиль сохранён');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeEmployee = useMutation({
    mutationFn: () => apiJson(`/employees/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Сотрудник удалён');
      navigate('/employees');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteLog = useMutation({
    mutationFn: (date: string) =>
      apiJson(`/employees/${id}/daily-log/${date}`, { method: 'DELETE' }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['employee-daily-logs', id] });
      await qc.invalidateQueries({ queryKey: ['employees-daily-board'] });
      toast.success('Отметка удалена');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (employee.isLoading) return <Skeleton className="h-48 w-full" />;
  if (!employee.data) return <p className="text-muted">Сотрудник не найден</p>;

  const logItems = logs.data?.items ?? [];
  const weeklyAvg =
    logItems.length > 0
      ? Math.round(logItems.reduce((s, x) => s + x.score, 0) / 7)
      : 0;
  const wa = whatsappHref(phone);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link to="/employees">
            <ArrowLeft className="size-4" />
            Назад
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-white">{employee.data.name}</h1>
          <Badge tone={statusTone(employee.data.status)}>{ruEmployeeStatus(employee.data.status)}</Badge>
          <Badge tone={kpiTone(weeklyAvg)}>KPI недели ~{weeklyAvg}%</Badge>
        </div>
      </div>

      <Card className="space-y-3 p-4">
        <h2 className="text-[14px] font-semibold">Профиль</h2>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Имя" />
        <Input value={position} onChange={(e) => setPosition(e.target.value)} placeholder="Должность" />
        <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Телефон WhatsApp" />
        <select
          className="h-10 w-full rounded-lg border border-stroke bg-transparent px-3 text-[13px] dark:border-white/10"
          value={status}
          onChange={(e) => setStatus(e.target.value as EmployeeStatus)}
        >
          <option value="ACTIVE">Активен</option>
          <option value="ON_LEAVE">В отпуске</option>
          <option value="INACTIVE">Неактивен</option>
        </select>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => saveProfile.mutate()} disabled={!name.trim()}>
            Сохранить
          </Button>
          {wa ? (
            <Button variant="outline" asChild>
              <a href={wa} target="_blank" rel="noreferrer">
                <MessageCircle className="size-4" />
                WhatsApp
              </a>
            </Button>
          ) : null}
          <Button
            variant="outline"
            className="text-red-500"
            onClick={() => {
              if (confirm('Удалить сотрудника навсегда?')) removeEmployee.mutate();
            }}
          >
            <Trash2 className="size-4" />
            Удалить
          </Button>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-stroke px-4 py-3 dark:border-white/10">
          <h2 className="text-[14px] font-semibold">Отметки за неделю</h2>
          <p className="text-[12px] text-muted">Редактируйте на главной странице «Сотрудники» или удалите здесь</p>
        </div>
        {logs.isLoading ? (
          <Skeleton className="m-4 h-24" />
        ) : logItems.length === 0 ? (
          <p className="px-4 py-6 text-[13px] text-muted">Пока нет отметок за эту неделю</p>
        ) : (
          <ul className="divide-y divide-stroke dark:divide-white/10">
            {logItems.map((log) => (
              <li key={log.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="text-[14px] font-medium">{log.date}</p>
                  <p className="text-[12px] text-muted">
                    Отчёт {log.reportOnTime ? '✓' : '—'} · План {log.planDone ? '✓' : '—'} · Дисциплина{' '}
                    {log.noViolations ? '✓' : '—'} · Качество {log.qualityOk ? '✓' : '—'}
                  </p>
                  {log.planText ? (
                    <p className="mt-1 text-[12px] text-muted line-clamp-2">{log.planText}</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={kpiTone(log.score)}>{Math.round(log.score)}%</Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-500"
                    onClick={() => {
                      if (confirm(`Удалить отметку за ${log.date}?`)) deleteLog.mutate(log.date);
                    }}
                  >
                    Удалить
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
