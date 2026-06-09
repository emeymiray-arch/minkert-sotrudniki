import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cnRoleRu } from '@/lib/format';
import { apiJson } from '@/lib/http';
import type { UserRole } from '@/lib/types';

type Account = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  linkedEmployeeId: string | null;
};

const ROLES: UserRole[] = ['ADMIN', 'MANAGER', 'MASTER', 'VIEWER', 'LOYALTY'];

export function AccountsManager() {
  const qc = useQueryClient();
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState({ name: '', email: '', password: '', role: 'LOYALTY' as UserRole, linkedEmployeeId: '' });

  const accountsQ = useQuery({
    queryKey: ['users', 'list'],
    queryFn: () => apiJson<Account[]>('/users'),
    staleTime: 60_000,
  });

  const saveMu = useMutation({
    mutationFn: (body: { id: string; name: string; email: string; password?: string; role: UserRole; linkedEmployeeId?: string }) => {
      const payload: Record<string, string> = {
        name: body.name.trim(),
        email: body.email.trim(),
        role: body.role,
      };
      if (body.password && body.password.length >= 6) payload.password = body.password;
      if (body.role === 'VIEWER' || body.role === 'MASTER') {
        payload.linkedEmployeeId = body.linkedEmployeeId?.trim() ?? '';
      }
      return apiJson(`/users/${body.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['users', 'list'] });
      setEditingId(null);
      toast.success('Данные для входа обновлены');
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Ошибка сохранения'),
  });

  const startEdit = (a: Account) => {
    setEditingId(a.id);
    setDraft({
      name: a.name,
      email: a.email,
      password: '',
      role: a.role,
      linkedEmployeeId: a.linkedEmployeeId ?? '',
    });
  };

  return (
    <Card>
      <CardHeader
        title="Аккаунты сотрудников"
        description="Меняйте email и пароль при смене сотрудников. Новый пароль — минимум 6 символов (оставьте пустым, если не меняете)."
      />
      {accountsQ.isLoading ?
        <Skeleton className="h-32" />
      : <div className="space-y-2">
          {(accountsQ.data ?? []).map((a) => (
            <div key={a.id} className="rounded-xl border border-stroke p-3 dark:border-white/[0.08]">
              {editingId === a.id ?
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} placeholder="Имя" />
                  <Input value={draft.email} onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))} placeholder="Email (логин)" />
                  <Input
                    type="password"
                    value={draft.password}
                    onChange={(e) => setDraft((d) => ({ ...d, password: e.target.value }))}
                    placeholder="Новый пароль (необязательно)"
                  />
                  <select
                    className="h-10 rounded-lg border border-stroke bg-[hsl(var(--panel))] px-3 text-sm outline-none dark:border-white/[0.08]"
                    value={draft.role}
                    onChange={(e) => setDraft((d) => ({ ...d, role: e.target.value as UserRole }))}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {cnRoleRu(r)}
                      </option>
                    ))}
                  </select>
                  {draft.role === 'VIEWER' || draft.role === 'MASTER' ?
                    <Input
                      className="sm:col-span-2"
                      value={draft.linkedEmployeeId}
                      onChange={(e) => setDraft((d) => ({ ...d, linkedEmployeeId: e.target.value }))}
                      placeholder="ID карточки сотрудника"
                    />
                  : null}
                  <div className="flex gap-2 sm:col-span-2">
                    <Button
                      disabled={saveMu.isPending || !draft.name.trim() || !draft.email.trim()}
                      onClick={() =>
                        saveMu.mutate({
                          id: a.id,
                          name: draft.name,
                          email: draft.email,
                          password: draft.password || undefined,
                          role: draft.role,
                          linkedEmployeeId: draft.linkedEmployeeId,
                        })
                      }
                    >
                      Сохранить
                    </Button>
                    <Button variant="outline" onClick={() => setEditingId(null)}>
                      Отмена
                    </Button>
                  </div>
                </div>
              : <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-medium text-zinc-900 dark:text-white">{a.name}</div>
                    <div className="text-sm text-muted">{a.email}</div>
                    <div className="text-xs text-muted">{cnRoleRu(a.role)}</div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => startEdit(a)}>
                    Изменить логин / пароль
                  </Button>
                </div>
              }
            </div>
          ))}
        </div>
      }
    </Card>
  );
}
