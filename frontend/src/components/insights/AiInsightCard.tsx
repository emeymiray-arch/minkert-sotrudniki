import { useQuery } from '@tanstack/react-query';

import { Card, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { apiJson } from '@/lib/http';

type AiInsight = {
  role: string;
  conclusions: string[];
  recommendations: string[];
};

export function AiInsightCard({
  title,
  endpoint,
  description,
}: {
  title: string;
  endpoint: string;
  description?: string;
}) {
  const q = useQuery({
    queryKey: ['insights', 'ai', endpoint],
    queryFn: () => apiJson<AiInsight>(endpoint),
    staleTime: 300_000,
  });

  return (
    <Card>
      <CardHeader title={title} description={description} />
      {q.isLoading ?
        <Skeleton className="h-28" />
      : !q.data ?
        <p className="text-sm text-muted">Нет данных</p>
      : <div className="space-y-3 text-[13px]">
          <ul className="space-y-1.5 text-zinc-800 dark:text-white/90">
            {q.data.conclusions.map((line) => (
              <li key={line} className="leading-snug">
                {line}
              </li>
            ))}
          </ul>
          {q.data.recommendations.length ?
            <div className="rounded-lg border border-stroke bg-black/[0.02] p-3 dark:border-white/[0.08] dark:bg-white/[0.03]">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">Рекомендации</div>
              <ul className="space-y-1 text-zinc-700 dark:text-white/80">
                {q.data.recommendations.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          : null}
        </div>
      }
    </Card>
  );
}
