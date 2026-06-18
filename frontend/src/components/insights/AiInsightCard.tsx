import { Card, CardHeader } from '@/components/ui/card';

export type AiInsight = {
  role: string;
  conclusions: string[];
  recommendations: string[];
};

export function AiInsightCard({
  title,
  data,
  description,
}: {
  title: string;
  data: AiInsight;
  description?: string;
}) {
  return (
    <Card>
      <CardHeader title={title} description={description} />
      <div className="space-y-3 text-[13px]">
        <ul className="space-y-1.5 text-zinc-800 dark:text-white/90">
          {data.conclusions.map((line) => (
            <li key={line} className="leading-snug">
              {line}
            </li>
          ))}
        </ul>
        {data.recommendations.length ?
          <div className="rounded-lg border border-stroke bg-black/[0.02] p-3 dark:border-white/[0.08] dark:bg-white/[0.03]">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">Рекомендации</div>
            <ul className="space-y-1 text-zinc-700 dark:text-white/80">
              {data.recommendations.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        : null}
      </div>
    </Card>
  );
}
