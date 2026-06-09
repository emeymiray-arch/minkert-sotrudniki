import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { apiJson } from '@/lib/http';

type CrmSalon = { id: string; name: string; address: string };
type Master = { id: string; name: string; position: string };
type Workspace = {
  salons: CrmSalon[];
  masterEmployeeIds: string[];
  masters: Master[];
};

export function CrmWorkspaceSettings({ disabled }: { disabled?: boolean }) {
  const qc = useQueryClient();
  const wsQ = useQuery({
    queryKey: ['crm', 'workspace'],
    queryFn: () => apiJson<Workspace>('/crm/workspace'),
    staleTime: 60_000,
  });

  const employeesQ = useQuery({
    queryKey: ['employees', 'all-masters-pick'],
    queryFn: () => apiJson<{ items: Master[] }>('/employees?sort=nameAsc'),
    staleTime: 120_000,
  });

  const [salons, setSalons] = React.useState<CrmSalon[]>([]);
  const [masterIds, setMasterIds] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (!wsQ.data) return;
    setSalons(wsQ.data.salons);
    setMasterIds(wsQ.data.masterEmployeeIds);
  }, [wsQ.data]);

  const saveMu = useMutation({
    mutationFn: () =>
      apiJson('/crm/workspace', {
        method: 'PATCH',
        body: JSON.stringify({ salons, masterEmployeeIds: masterIds }),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['crm', 'workspace'] });
      toast.success('Салоны и мастера сохранены');
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Ошибка'),
  });

  if (wsQ.isLoading) return <Skeleton className="h-48" />;

  const allEmployees = employeesQ.data?.items ?? [];

  return (
    <Card>
      <CardHeader
        title="Салоны и мастера"
        description="Два адреса салона и до трёх мастеров. На одного мастера нельзя записать двух клиенток на одно время."
      />
      <div className="space-y-4">
        <div className="space-y-3">
          <div className="text-sm font-semibold">Адреса салонов</div>
          {salons.map((salon, idx) => (
            <div key={salon.id} className="grid gap-2 rounded-lg border border-stroke p-3 dark:border-white/[0.08] sm:grid-cols-2">
              <Input
                placeholder="Название"
                value={salon.name}
                disabled={disabled}
                onChange={(e) => {
                  const next = [...salons];
                  next[idx] = { ...salon, name: e.target.value };
                  setSalons(next);
                }}
              />
              <Input
                placeholder="Адрес"
                value={salon.address}
                disabled={disabled}
                onChange={(e) => {
                  const next = [...salons];
                  next[idx] = { ...salon, address: e.target.value };
                  setSalons(next);
                }}
              />
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <div className="text-sm font-semibold">Мастера (отметьте до 3)</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {allEmployees.map((emp) => {
              const checked = masterIds.includes(emp.id);
              return (
                <label
                  key={emp.id}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-stroke px-3 py-2 text-sm dark:border-white/[0.08]"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled || (!checked && masterIds.length >= 3)}
                    onChange={() => {
                      if (checked) setMasterIds(masterIds.filter((id) => id !== emp.id));
                      else if (masterIds.length < 3) setMasterIds([...masterIds, emp.id]);
                    }}
                  />
                  <span>
                    <span className="font-medium">{emp.name}</span>
                    {emp.position ? <span className="text-muted"> · {emp.position}</span> : null}
                  </span>
                </label>
              );
            })}
          </div>
          {masterIds.length === 0 ?
            <p className="text-xs text-muted">Если не выбрано — используются сотрудники с ролью «Мастер» (MANAGER).</p>
          : null}
        </div>

        <Button disabled={disabled || saveMu.isPending} onClick={() => saveMu.mutate()}>
          Сохранить
        </Button>
      </div>
    </Card>
  );
}
