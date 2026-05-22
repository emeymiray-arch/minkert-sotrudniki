import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { apiJson } from '@/lib/http';

type StaffRow = {
  id: string;
  name: string;
  position: string;
  status: string;
  opsProfile?: {
    disciplineLevel: number;
    warningsCount: number;
    schedule: string;
  } | null;
  _count?: { opsViolations: number; opsTasks: number };
};

export default function OpsStaffPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['ops', 'staff'],
    queryFn: () => apiJson<{ items: StaffRow[] }>('/operations/staff'),
  });

  if (isLoading) return <Skeleton className="h-[240px]" />;

  return (
    <Card>
      <CardHeader
        title="Сотрудники"
        description="Дисциплина, продуктивность и заметки. Добавление и удаление — в основном разделе «Сотрудники»."
      />
      <Button variant="outline" size="sm" className="mb-4" asChild>
        <Link to="/employees">Управление кадрами Minkert</Link>
      </Button>
      <div className="divide-y divide-stroke dark:divide-white/[0.08]">
        {(data?.items ?? []).map((e) => (
          <Link
            key={e.id}
            to={`/upravlenie/sotrudniki/${e.id}`}
            className="flex flex-wrap items-center justify-between gap-3 px-1 py-3 transition hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
          >
            <div>
              <div className="font-semibold text-zinc-900 dark:text-white">{e.name}</div>
              <div className="text-xs text-muted">{e.position}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge tone="neutral">Дисциплина: {e.opsProfile?.disciplineLevel ?? 100}%</Badge>
              <Badge tone={e._count?.opsViolations ? 'warning' : 'success'}>
                Нарушений: {e._count?.opsViolations ?? 0}
              </Badge>
            </div>
          </Link>
        ))}
      </div>
    </Card>
  );
}
