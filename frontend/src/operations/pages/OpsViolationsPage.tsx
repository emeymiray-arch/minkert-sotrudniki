import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { apiJson } from '@/lib/http';
import type { OpsViolationType } from '@/operations/types';
import { OPS_VIOLATION_LABELS } from '@/operations/types';

type Violation = {
  id: string;
  type: OpsViolationType;
  description: string;
  occurredAt: string;
  warned: boolean;
  employee: { id: string; name: string; position: string };
};

export default function OpsViolationsPage() {
  const [employeeId, setEmployeeId] = React.useState('');
  const [type, setType] = React.useState<OpsViolationType>('LATE');
  const [description, setDescription] = React.useState('');
  const qc = useQueryClient();

  const listQ = useQuery({
    queryKey: ['ops', 'violations'],
    queryFn: () => apiJson<Violation[]>('/operations/violations'),
  });

  const staffQ = useQuery({
    queryKey: ['ops', 'staff'],
    queryFn: () => apiJson<{ items: Array<{ id: string; name: string }> }>('/operations/staff'),
  });

  const createMu = useMutation({
    mutationFn: () =>
      apiJson('/operations/violations', {
        method: 'POST',
        body: JSON.stringify({ employeeId, type, description, warned: true }),
      }),
    onSuccess: () => {
      setDescription('');
      void qc.invalidateQueries({ queryKey: ['ops', 'violations'] });
      void qc.invalidateQueries({ queryKey: ['ops', 'dashboard'] });
      toast.success('Нарушение зафиксировано');
    },
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Новое нарушение" description="Опоздания, отчёты, дисциплина — с историей." />
        <div className="grid gap-3 sm:grid-cols-2">
          <select
            className="rounded-lg border border-stroke bg-transparent px-3 py-2 text-sm dark:border-white/10"
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
          >
            <option value="">Сотрудник…</option>
            {(staffQ.data?.items ?? []).map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
          <select
            className="rounded-lg border border-stroke bg-transparent px-3 py-2 text-sm dark:border-white/10"
            value={type}
            onChange={(e) => setType(e.target.value as OpsViolationType)}
          >
            {(Object.keys(OPS_VIOLATION_LABELS) as OpsViolationType[]).map((k) => (
              <option key={k} value={k}>
                {OPS_VIOLATION_LABELS[k]}
              </option>
            ))}
          </select>
        </div>
        <Textarea className="mt-3" placeholder="Описание…" value={description} onChange={(e) => setDescription(e.target.value)} />
        <Button className="mt-3" disabled={!employeeId || createMu.isPending} onClick={() => createMu.mutate()}>
          Зафиксировать
        </Button>
      </Card>

      <Card>
        <CardHeader title="История нарушений" />
        <ul className="space-y-2">
          {(listQ.data ?? []).map((v) => (
            <li key={v.id} className="rounded-xl border border-stroke px-4 py-3 text-sm dark:border-white/[0.08]">
              <div className="font-semibold text-zinc-900 dark:text-white">
                {v.employee.name} · {OPS_VIOLATION_LABELS[v.type]}
              </div>
              <div className="text-muted dark:text-white/50">{v.description}</div>
              <div className="mt-1 text-xs text-muted">{new Date(v.occurredAt).toLocaleString('ru-RU')}</div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
