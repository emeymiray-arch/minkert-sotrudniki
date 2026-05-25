import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { apiJson } from '@/lib/http';
import { OPS_VIOLATION_LABELS } from '@/operations/types';

export default function OpsStaffDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['ops', 'staff', id],
    queryFn: () =>
      apiJson<{
        employee: {
          id: string;
          name: string;
          position: string;
          opsProfile: Record<string, string | number> | null;
          opsViolations: Array<{ id: string; type: string; description: string; occurredAt: string }>;
        };
        todayTasks: { total: number; done: number; pending: number };
      }>(`/operations/staff/${id}`),
    enabled: Boolean(id),
  });

  const saveMu = useMutation({
    mutationFn: (body: Record<string, string | number>) =>
      apiJson(`/operations/staff/${id}/profile`, { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['ops', 'staff', id] });
      toast.success('Профиль сохранён');
    },
  });

  if (isLoading || !data) return <Skeleton className="h-[320px]" />;

  const p = data.employee.opsProfile ?? {
    schedule: '',
    disciplineLevel: 100,
    warningsCount: 0,
    preferences: '',
    workStyle: '',
    traits: '',
    managerNotes: '',
    clientAttitude: '',
    qualityNotes: '',
  };

  const fields: Array<{ key: string; label: string; multiline?: boolean }> = [
    { key: 'schedule', label: 'График' },
    { key: 'preferences', label: 'Предпочтения', multiline: true },
    { key: 'workStyle', label: 'Формат работы', multiline: true },
    { key: 'traits', label: 'Особенности', multiline: true },
    { key: 'clientAttitude', label: 'Отношение к клиентам', multiline: true },
    { key: 'qualityNotes', label: 'Качество работы', multiline: true },
    { key: 'managerNotes', label: 'Заметки управляющей', multiline: true },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title={data.employee.name} description={data.employee.position} />
        <div className="flex flex-wrap gap-4 text-sm">
          <Link
            to={`/upravlenie/zhurnal?employeeId=${data.employee.id}`}
            className="text-accent underline-offset-2 hover:underline"
          >
            История фиксаций →
          </Link>
          <span>
            Задач сегодня: <strong>{data.todayTasks.done}</strong> / {data.todayTasks.total}
          </span>
          <span>
            Дисциплина: <strong>{String(p.disciplineLevel)}%</strong>
          </span>
          <span>
            Предупреждений: <strong>{String(p.warningsCount)}</strong>
          </span>
        </div>
      </Card>

      <Card>
        <CardHeader title="Карточка сотрудника" description="Редактируемые поля для CRM-подхода." />
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const body: Record<string, string | number> = {};
            for (const f of fields) body[f.key] = String(fd.get(f.key) ?? '');
            body.disciplineLevel = Number(fd.get('disciplineLevel') ?? 100);
            body.warningsCount = Number(fd.get('warningsCount') ?? 0);
            saveMu.mutate(body);
          }}
        >
          {fields.map((f) =>
            f.multiline ?
              <label key={f.key} className="block text-sm">
                {f.label}
                <Textarea name={f.key} className="mt-1" defaultValue={String(p[f.key] ?? '')} />
              </label>
            : <label key={f.key} className="block text-sm">
                {f.label}
                <Input name={f.key} className="mt-1" defaultValue={String(p[f.key] ?? '')} />
              </label>,
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm">
              Уровень дисциплины (%)
              <Input name="disciplineLevel" type="number" className="mt-1" defaultValue={String(p.disciplineLevel)} />
            </label>
            <label className="text-sm">
              Предупреждений
              <Input name="warningsCount" type="number" className="mt-1" defaultValue={String(p.warningsCount)} />
            </label>
          </div>
          <Button type="submit" disabled={saveMu.isPending}>
            Сохранить
          </Button>
        </form>
      </Card>

      <Card>
        <CardHeader title="История нарушений" />
        <ul className="space-y-2 text-sm">
          {data.employee.opsViolations.map((v) => (
            <li key={v.id} className="rounded-lg border border-stroke px-3 py-2 dark:border-white/[0.08]">
              <strong>{OPS_VIOLATION_LABELS[v.type as keyof typeof OPS_VIOLATION_LABELS] ?? v.type}</strong> —{' '}
              {v.description || '—'} · {new Date(v.occurredAt).toLocaleString('ru-RU')}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
