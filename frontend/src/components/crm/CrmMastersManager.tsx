import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { apiJson } from '@/lib/http';

type CrmSalon = { id: string; name: string; address: string };
type CrmMaster = {
  id: string;
  name: string;
  phone: string;
  specialty: string;
  salonId: string;
  active: boolean;
};

export function CrmMastersManager({ disabled }: { disabled?: boolean }) {
  const qc = useQueryClient();
  const [name, setName] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [specialty, setSpecialty] = React.useState('');
  const [salonId, setSalonId] = React.useState('');

  const workspaceQ = useQuery({
    queryKey: ['crm', 'workspace'],
    queryFn: () => apiJson<{ salons: CrmSalon[] }>('/crm/workspace'),
    staleTime: 60_000,
  });

  const mastersQ = useQuery({
    queryKey: ['crm', 'masters'],
    queryFn: () => apiJson<CrmMaster[]>('/crm/masters'),
    staleTime: 30_000,
  });

  const invalidate = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['crm', 'masters'] }),
      qc.invalidateQueries({ queryKey: ['crm', 'workspace'] }),
      qc.invalidateQueries({ queryKey: ['crm', 'schedule'] }),
    ]);

  const createMu = useMutation({
    mutationFn: () =>
      apiJson('/crm/masters', {
        method: 'POST',
        body: JSON.stringify({ name, phone, specialty, salonId }),
      }),
    onSuccess: async () => {
      setName('');
      setPhone('');
      setSpecialty('');
      await invalidate();
      toast.success('Мастер добавлен');
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Ошибка'),
  });

  const patchMu = useMutation({
    mutationFn: (body: { id: string; data: Partial<CrmMaster> }) =>
      apiJson(`/crm/masters/${body.id}`, { method: 'PATCH', body: JSON.stringify(body.data) }),
    onSuccess: invalidate,
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Ошибка'),
  });

  const salons = workspaceQ.data?.salons ?? [];

  return (
    <Card>
      <CardHeader
        title="Мастера салона"
        description="Отдельно от сотрудников KPI. Здесь — мастера для записи клиентов."
      />
      {mastersQ.isLoading ?
        <Skeleton className="h-24" />
      : <div className="space-y-2">
          {(mastersQ.data ?? []).filter((m) => m.active).map((m) => (
            <div key={m.id} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
              <Input
                defaultValue={m.name}
                disabled={disabled}
                onBlur={(e) => {
                  if (e.target.value.trim() !== m.name) patchMu.mutate({ id: m.id, data: { name: e.target.value.trim() } });
                }}
              />
              <Input
                defaultValue={m.phone}
                placeholder="Телефон"
                disabled={disabled}
                onBlur={(e) => {
                  if (e.target.value.trim() !== m.phone) patchMu.mutate({ id: m.id, data: { phone: e.target.value.trim() } });
                }}
              />
              <Input
                defaultValue={m.specialty}
                placeholder="Специализация"
                disabled={disabled}
                onBlur={(e) => {
                  if (e.target.value.trim() !== m.specialty) {
                    patchMu.mutate({ id: m.id, data: { specialty: e.target.value.trim() } });
                  }
                }}
              />
              <Button
                type="button"
                size="icon"
                variant="outline"
                disabled={disabled || patchMu.isPending}
                onClick={() => {
                  if (window.confirm(`Убрать мастера «${m.name}» из списка?`)) {
                    patchMu.mutate({ id: m.id, data: { active: false } });
                  }
                }}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      }

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Input placeholder="Имя мастера *" value={name} onChange={(e) => setName(e.target.value)} disabled={disabled} />
        <Input placeholder="Телефон" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={disabled} />
        <Input placeholder="Специализация" value={specialty} onChange={(e) => setSpecialty(e.target.value)} disabled={disabled} />
        <select
          className="h-10 rounded-lg border border-stroke bg-[hsl(var(--panel))] px-3 text-sm outline-none dark:border-white/[0.08]"
          value={salonId}
          onChange={(e) => setSalonId(e.target.value)}
          disabled={disabled}
        >
          <option value="">Салон (необяз.)</option>
          {salons.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <Button
        className="mt-3"
        disabled={disabled || !name.trim() || createMu.isPending}
        onClick={() => createMu.mutate()}
      >
        Добавить мастера
      </Button>
    </Card>
  );
}
