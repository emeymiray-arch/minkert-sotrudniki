import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { apiJson } from '@/lib/http';
import type { OpsBlockConfig, OpsTimeBlock } from '@/operations/types';

export default function OpsSettingsPage() {
  const qc = useQueryClient();

  const blocksQ = useQuery({
    queryKey: ['ops', 'blocks'],
    queryFn: () => apiJson<OpsBlockConfig[]>('/operations/blocks'),
  });

  const settingsQ = useQuery({
    queryKey: ['ops', 'settings'],
    queryFn: () => apiJson<{ formsWebhookNote: string; googleFormMappings: unknown }>('/operations/settings'),
  });

  const [note, setNote] = React.useState('');

  React.useEffect(() => {
    if (settingsQ.data?.formsWebhookNote) setNote(settingsQ.data.formsWebhookNote);
  }, [settingsQ.data]);

  const saveSettings = useMutation({
    mutationFn: () =>
      apiJson('/operations/settings', {
        method: 'PATCH',
        body: JSON.stringify({ formsWebhookNote: note }),
      }),
    onSuccess: () => toast.success('Настройки сохранены'),
  });

  const patchBlock = useMutation({
    mutationFn: (payload: { block: OpsTimeBlock; title?: string; timeStart?: string; timeEnd?: string }) =>
      apiJson(`/operations/blocks/${payload.block}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['ops', 'blocks'] }),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Блоки по времени" description="Названия и интервалы — полностью редактируемые." />
        <ul className="space-y-4">
          {(blocksQ.data ?? []).map((b) => (
            <li key={b.id} className="grid gap-2 rounded-xl border border-stroke p-4 sm:grid-cols-4 dark:border-white/[0.08]">
              <Input
                defaultValue={b.title}
                onBlur={(e) => patchBlock.mutate({ block: b.block, title: e.target.value })}
              />
              <Input
                defaultValue={b.timeStart}
                placeholder="Начало"
                onBlur={(e) => patchBlock.mutate({ block: b.block, timeStart: e.target.value })}
              />
              <Input
                defaultValue={b.timeEnd}
                placeholder="Конец"
                onBlur={(e) => patchBlock.mutate({ block: b.block, timeEnd: e.target.value })}
              />
              <span className="text-xs text-muted self-center">{b.block}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <CardHeader
          title="Google Forms"
          description="Вечерний отчёт: POST /api/operations/reports/ingest с formKey и employeeId."
        />
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Инструкция: какие формы кому, webhook из Zapier/Make…"
          rows={5}
        />
        <Button className="mt-3" onClick={() => saveSettings.mutate()} disabled={saveSettings.isPending}>
          Сохранить
        </Button>
        <p className="mt-3 text-xs text-muted dark:text-white/50">
          Пример тела запроса:{' '}
          <code className="rounded bg-black/5 px-1 dark:bg-white/10">
            {`{"formKey":"evening-report","employeeId":"…","status":"SUBMITTED","payload":{…}}`}
          </code>
        </p>
      </Card>

      <Card>
        <CardHeader title="История изменений" />
        <ActivityFeed />
      </Card>
    </div>
  );
}

function ActivityFeed() {
  const { data } = useQuery({
    queryKey: ['ops', 'activity'],
    queryFn: () => apiJson<Array<{ id: string; action: string; userName: string; entityType: string; createdAt: string }>>(
      '/operations/activity?limit=40',
    ),
  });
  return (
    <ul className="max-h-[280px] space-y-1 overflow-y-auto text-xs text-muted dark:text-white/50">
      {(data ?? []).map((a) => (
        <li key={a.id}>
          {new Date(a.createdAt).toLocaleString('ru-RU')} — {a.userName} — {a.action} ({a.entityType})
        </li>
      ))}
    </ul>
  );
}
