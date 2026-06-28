import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageCircle, Pencil, Plus, Trash2 } from 'lucide-react';
import * as React from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { utcMondayIso } from '@/lib/date';
import { apiJson } from '@/lib/http';
import { ruEmployeeStatus } from '@/lib/format';
import type { EmployeeDailyLog, EmployeeListItem, EmployeeStatus } from '@/lib/types';
import { todayIso } from '@/operations/constants';

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

type DailyBoardItem = {
  employee: EmployeeListItem;
  todayLog: EmployeeDailyLog | null;
  todayScore: number;
  kpiWeekly: number;
};

type DailyBoard = {
  date: string;
  weekAnchor: string;
  items: DailyBoardItem[];
};

export default function EmployeesPage() {
  const qc = useQueryClient();
  const [q, setQ] = React.useState('');
  const dq = useDebouncedValue(q, 300);
  const [date, setDate] = React.useState(todayIso());
  const weekAnchor = utcMondayIso(new Date(`${date}T12:00:00Z`));

  const [createOpen, setCreateOpen] = React.useState(false);
  const [newName, setNewName] = React.useState('');
  const [newPosition, setNewPosition] = React.useState('');
  const [newPhone, setNewPhone] = React.useState('');

  const [editOpen, setEditOpen] = React.useState(false);
  const [editId, setEditId] = React.useState<string | null>(null);
  const [editName, setEditName] = React.useState('');
  const [editPosition, setEditPosition] = React.useState('');
  const [editPhone, setEditPhone] = React.useState('');

  const board = useQuery({
    queryKey: ['employees-daily-board', date, weekAnchor],
    queryFn: () =>
      apiJson<DailyBoard>(
        `/employees/daily-board?date=${encodeURIComponent(date)}&weekAnchor=${encodeURIComponent(weekAnchor)}`,
      ),
  });

  const items = React.useMemo(() => {
    const raw = board.data?.items ?? [];
    const needle = dq.trim().toLowerCase();
    if (!needle) return raw;
    return raw.filter(
      (row) =>
        row.employee.name.toLowerCase().includes(needle) ||
        row.employee.position.toLowerCase().includes(needle),
    );
  }, [board.data?.items, dq]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['employees-daily-board'] });
    qc.invalidateQueries({ queryKey: ['employees'] });
  };

  const createEmployee = useMutation({
    mutationFn: () =>
      apiJson('/employees', {
        method: 'POST',
        body: JSON.stringify({
          name: newName.trim(),
          position: newPosition.trim(),
          phone: newPhone.trim(),
        }),
      }),
    onSuccess: async () => {
      setCreateOpen(false);
      setNewName('');
      setNewPosition('');
      setNewPhone('');
      await invalidate();
      toast.success('Сотрудник добавлен');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveEmployee = useMutation({
    mutationFn: () =>
      apiJson(`/employees/${editId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: editName.trim(),
          position: editPosition.trim(),
          phone: editPhone.trim(),
        }),
      }),
    onSuccess: async () => {
      setEditOpen(false);
      await invalidate();
      toast.success('Сохранено');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeEmployee = useMutation({
    mutationFn: (id: string) => apiJson(`/employees/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      await invalidate();
      toast.success('Удалено');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveDailyLog = useMutation({
    mutationFn: ({
      employeeId,
      body,
    }: {
      employeeId: string;
      body: Partial<EmployeeDailyLog> & { date: string };
    }) =>
      apiJson(`/employees/${employeeId}/daily-log`, {
        method: 'PUT',
        body: JSON.stringify(body),
      }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const openEdit = (employee: EmployeeListItem) => {
    setEditId(employee.id);
    setEditName(employee.name);
    setEditPosition(employee.position);
    setEditPhone(employee.phone ?? '');
    setEditOpen(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Сотрудники"
        description="План в WhatsApp, отметки за день и KPI недели — всё вносите вы."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            Добавить
          </Button>
        }
      />

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-[12px] font-medium text-muted">День</label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-[160px]" />
        </div>
        <div className="min-w-[200px] flex-1">
          <label className="mb-1 block text-[12px] font-medium text-muted">Поиск</label>
          <Input placeholder="Имя или должность" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {board.isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : items.length === 0 ? (
        <Card className="p-8 text-center text-[13px] text-muted">Нет сотрудников — добавьте первого.</Card>
      ) : (
        <div className="space-y-4">
          {items.map((row) => (
            <EmployeeDayCard
              key={row.employee.id}
              row={row}
              date={date}
              onSave={(body) => saveDailyLog.mutate({ employeeId: row.employee.id, body })}
              onEdit={() => openEdit(row.employee)}
              onDelete={() => {
                if (confirm(`Удалить сотрудника «${row.employee.name}»?`)) {
                  removeEmployee.mutate(row.employee.id);
                }
              }}
              saving={saveDailyLog.isPending}
            />
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogTitle>Новый сотрудник</DialogTitle>
          <div className="space-y-3 pt-2">
            <Input placeholder="Имя" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <Input placeholder="Должность" value={newPosition} onChange={(e) => setNewPosition(e.target.value)} />
            <Input placeholder="Телефон для WhatsApp" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
            <Button
              className="w-full"
              onClick={() => createEmployee.mutate()}
              disabled={!newName.trim() || !newPosition.trim()}
            >
              Создать
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogTitle>Редактировать сотрудника</DialogTitle>
          <div className="space-y-3 pt-2">
            <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            <Input value={editPosition} onChange={(e) => setEditPosition(e.target.value)} />
            <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="Телефон" />
            <Button className="w-full" onClick={() => saveEmployee.mutate()} disabled={!editName.trim()}>
              Сохранить
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EmployeeDayCard({
  row,
  date,
  onSave,
  onEdit,
  onDelete,
  saving,
}: {
  row: DailyBoardItem;
  date: string;
  onSave: (body: Partial<EmployeeDailyLog> & { date: string }) => void;
  onEdit: () => void;
  onDelete: () => void;
  saving: boolean;
}) {
  const { employee, todayLog, todayScore, kpiWeekly } = row;
  const [planText, setPlanText] = React.useState(todayLog?.planText ?? '');
  const [notes, setNotes] = React.useState(todayLog?.notes ?? '');
  const [reportOnTime, setReportOnTime] = React.useState(todayLog?.reportOnTime ?? false);
  const [planDone, setPlanDone] = React.useState(todayLog?.planDone ?? false);
  const [noViolations, setNoViolations] = React.useState(todayLog?.noViolations ?? false);
  const [qualityOk, setQualityOk] = React.useState(todayLog?.qualityOk ?? false);

  React.useEffect(() => {
    setPlanText(todayLog?.planText ?? '');
    setNotes(todayLog?.notes ?? '');
    setReportOnTime(todayLog?.reportOnTime ?? false);
    setPlanDone(todayLog?.planDone ?? false);
    setNoViolations(todayLog?.noViolations ?? false);
    setQualityOk(todayLog?.qualityOk ?? false);
  }, [todayLog, employee.id, date]);

  const wa = whatsappHref(employee.phone ?? '');

  return (
    <Card className="space-y-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Link to={`/employees/${employee.id}`} className="text-[16px] font-semibold text-zinc-900 hover:underline dark:text-white">
              {employee.name}
            </Link>
            <Badge tone={statusTone(employee.status)}>{ruEmployeeStatus(employee.status)}</Badge>
            <Badge tone={kpiTone(kpiWeekly)}>Неделя {kpiWeekly}%</Badge>
            <Badge tone={kpiTone(todayScore)}>Сегодня {Math.round(todayScore)}%</Badge>
          </div>
          <p className="mt-0.5 text-[13px] text-muted">{employee.position}</p>
        </div>
        <div className="flex gap-1">
          {wa ? (
            <Button size="sm" variant="outline" asChild>
              <a href={wa} target="_blank" rel="noreferrer">
                <MessageCircle className="size-4" />
                WhatsApp
              </a>
            </Button>
          ) : null}
          <Button size="icon" variant="ghost" onClick={onEdit} aria-label="Изменить">
            <Pencil className="size-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={onDelete} aria-label="Удалить">
            <Trash2 className="size-4 text-red-500" />
          </Button>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-[12px] font-medium text-muted">План дня (что отправили в WhatsApp)</label>
        <Textarea
          rows={2}
          value={planText}
          onChange={(e) => setPlanText(e.target.value)}
          placeholder="• Открытие кабинета&#10;• 3 записи без опозданий"
        />
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <MarkRow label="Отчёт вовремя" checked={reportOnTime} onChange={setReportOnTime} />
        <MarkRow label="План выполнен" checked={planDone} onChange={setPlanDone} />
        <MarkRow label="Без нарушений" checked={noViolations} onChange={setNoViolations} />
        <MarkRow label="Качество в норме" checked={qualityOk} onChange={setQualityOk} />
      </div>

      <Input
        placeholder="Заметка (необязательно)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />

      <Button
        onClick={() =>
          onSave({
            date,
            planText,
            notes,
            reportOnTime,
            planDone,
            noViolations,
            qualityOk,
          })
        }
        disabled={saving}
      >
        Сохранить день
      </Button>
    </Card>
  );
}

function MarkRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-stroke px-3 py-2 text-[13px] dark:border-white/10">
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(Boolean(v))} />
      {label}
    </label>
  );
}
