import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { apiJson } from '@/lib/http';

type CrmSalon = { id: string; name: string; address: string };

export function CrmWorkspaceSettings({ disabled }: { disabled?: boolean }) {
  const qc = useQueryClient();
  const wsQ = useQuery({
    queryKey: ['crm', 'workspace'],
    queryFn: () => apiJson<{ salons: CrmSalon[] }>('/crm/workspace'),
    staleTime: 60_000,
  });

  const [salons, setSalons] = React.useState<CrmSalon[]>([]);

  React.useEffect(() => {
    if (!wsQ.data) return;
    setSalons(wsQ.data.salons);
  }, [wsQ.data]);

  const saveMu = useMutation({
    mutationFn: () =>
      apiJson('/crm/workspace', {
        method: 'PATCH',
        body: JSON.stringify({ salons }),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['crm', 'workspace'] });
      toast.success('Адреса салонов сохранены');
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Ошибка'),
  });

  if (wsQ.isLoading) return <Skeleton className="h-48" />;

  return (
    <Card>
      <CardHeader title="Адреса салонов" description="Два салона для записи клиентов. Мастеров добавляйте во вкладке «Мастера»." />
      <div className="space-y-3">
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
        <Button disabled={disabled || saveMu.isPending} onClick={() => saveMu.mutate()}>
          Сохранить салоны
        </Button>
      </div>
    </Card>
  );
}
