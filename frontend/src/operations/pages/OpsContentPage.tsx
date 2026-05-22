import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { todayIso } from '@/operations/constants';
import { apiJson } from '@/lib/http';

export default function OpsContentPage() {
  const [date, setDate] = React.useState(todayIso());
  const qc = useQueryClient();

  const listQ = useQuery({
    queryKey: ['ops', 'content', date],
    queryFn: () => apiJson<Array<{ id: string; title: string; roleType: string; checked: boolean; employee: { name: string } }>>(
      `/operations/content-reviews?date=${date}`,
    ),
  });

  const [employeeId, setEmployeeId] = React.useState('');
  const [roleType, setRoleType] = React.useState<'STORY' | 'REEL'>('STORY');
  const [title, setTitle] = React.useState('');

  const staffQ = useQuery({
    queryKey: ['ops', 'staff'],
    queryFn: () => apiJson<{ items: Array<{ id: string; name: string }> }>('/operations/staff'),
  });

  const createMu = useMutation({
    mutationFn: () =>
      apiJson('/operations/content-reviews', {
        method: 'POST',
        body: JSON.stringify({ employeeId, roleType, title, reviewDate: date }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['ops', 'content', date] });
      toast.success('Запись добавлена');
    },
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Контроль контента"
          description="Сторисмейкер и рилсмейкер — проверка на следующий день."
        />
        <Input type="date" className="max-w-[180px]" value={date} onChange={(e) => setDate(e.target.value)} />
      </Card>

      <Card>
        <CardHeader title="Новая проверка" />
        <div className="flex flex-wrap gap-2">
          <select
            className="rounded-lg border border-stroke px-3 py-2 text-sm dark:border-white/10"
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
          >
            <option value="">Сотрудник</option>
            {(staffQ.data?.items ?? []).map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
          <select
            className="rounded-lg border border-stroke px-3 py-2 text-sm dark:border-white/10"
            value={roleType}
            onChange={(e) => setRoleType(e.target.value as 'STORY' | 'REEL')}
          >
            <option value="STORY">Сторис</option>
            <option value="REEL">Рилс</option>
          </select>
          <Input placeholder="Название публикации" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Button disabled={!employeeId} onClick={() => createMu.mutate()}>
            Добавить
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader title="Проверки за день" />
        <ul className="space-y-2 text-sm">
          {(listQ.data ?? []).map((r) => (
            <li key={r.id} className="flex justify-between rounded-lg border border-stroke px-3 py-2 dark:border-white/[0.08]">
              <span>
                {r.employee.name} · {r.roleType === 'STORY' ? 'Сторис' : 'Рилс'} · {r.title}
              </span>
              <span className={r.checked ? 'text-emerald-600' : 'text-amber-600'}>{r.checked ? 'Проверено' : 'Ожидает'}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
