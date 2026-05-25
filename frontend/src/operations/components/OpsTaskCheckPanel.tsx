import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { apiJson } from '@/lib/http';
import { ATTENDANCE_LABELS, CHECK_TYPE_LABEL } from '@/operations/check-labels';
import type { OpsAttendanceMark, OpsCheckSheet, OpsTaskCheckType } from '@/operations/types';

type RowDraft = {
  employeeId: string;
  attendanceMark: OpsAttendanceMark | null;
  checklistOpened: boolean | null;
  checklistDone: boolean | null;
  checklistIgnored: boolean | null;
  reportSubmitted: boolean | null;
  reportError: boolean | null;
  reportNeedsFix: boolean | null;
  comment: string;
  extraNote: string;
  flagViolation: boolean;
};

function entryToDraft(employeeId: string, entry: OpsCheckSheet['rows'][0]['entry']): RowDraft {
  return {
    employeeId,
    attendanceMark: entry?.attendanceMark ?? null,
    checklistOpened: entry?.checklistOpened ?? null,
    checklistDone: entry?.checklistDone ?? null,
    checklistIgnored: entry?.checklistIgnored ?? null,
    reportSubmitted: entry?.reportSubmitted ?? null,
    reportError: entry?.reportError ?? null,
    reportNeedsFix: entry?.reportNeedsFix ?? null,
    comment: entry?.comment ?? '',
    extraNote: entry?.extraNote ?? '',
    flagViolation: entry?.flagViolation ?? false,
  };
}

type Props = {
  taskId: string;
  recordDate: string;
  checkType: OpsTaskCheckType;
  compact?: boolean;
  onSaved?: () => void;
};

export function OpsTaskCheckPanel({ taskId, recordDate, checkType, compact, onSaved }: Props) {
  const qc = useQueryClient();
  const sheetQ = useQuery({
    queryKey: ['ops', 'check-sheet', taskId, recordDate],
    queryFn: () => apiJson<OpsCheckSheet>(`/operations/tasks/${taskId}/check-sheet?date=${recordDate}`),
  });

  const [drafts, setDrafts] = React.useState<RowDraft[]>([]);

  React.useEffect(() => {
    if (!sheetQ.data) return;
    setDrafts(sheetQ.data.rows.map((r) => entryToDraft(r.employee.id, r.entry)));
  }, [sheetQ.data]);

  const saveMu = useMutation({
    mutationFn: () =>
      apiJson(`/operations/tasks/${taskId}/check-sheet?date=${recordDate}`, {
        method: 'PUT',
        body: JSON.stringify({ rows: drafts }),
      }),
    onSuccess: () => {
      toast.success('Сохранено');
      void qc.invalidateQueries({ queryKey: ['ops', 'check-sheet', taskId, recordDate] });
      onSaved?.();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Ошибка'),
  });

  if (sheetQ.isLoading) return <Skeleton className="mt-2 h-16" />;
  if (!sheetQ.data) return null;

  const update = (employeeId: string, patch: Partial<RowDraft>) => {
    setDrafts((prev) => prev.map((d) => (d.employeeId === employeeId ? { ...d, ...patch } : d)));
  };

  return (
    <div
      className={`mt-2 rounded-lg border border-stroke/80 bg-black/[0.02] dark:border-white/[0.08] dark:bg-white/[0.03] ${
        compact ? 'p-2' : 'p-3'
      }`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted dark:text-white/45">
          {CHECK_TYPE_LABEL[checkType]}
        </span>
        <Button type="button" size="sm" className="h-7 gap-1 px-2 text-[11px]" disabled={saveMu.isPending} onClick={() => saveMu.mutate()}>
          <Save className="size-3" />
          Сохранить
        </Button>
      </div>

      <div className="max-h-[220px] space-y-1 overflow-y-auto">
        {sheetQ.data.rows.map((row) => {
          const d = drafts.find((x) => x.employeeId === row.employee.id);
          if (!d) return null;
          return (
            <div
              key={row.employee.id}
              className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-stroke/40 py-1.5 text-[11px] last:border-0 dark:border-white/[0.06]"
            >
              <span className="min-w-[7rem] font-medium text-zinc-800 dark:text-white/90">{row.employee.name}</span>
              {checkType === 'ATTENDANCE' ?
                (Object.keys(ATTENDANCE_LABELS) as OpsAttendanceMark[]).map((mark) => (
                  <label key={mark} className="inline-flex items-center gap-0.5">
                    <input
                      type="radio"
                      name={`att-${row.employee.id}`}
                      checked={d.attendanceMark === mark}
                      onChange={() => update(row.employee.id, { attendanceMark: mark })}
                      className="size-3"
                    />
                    {ATTENDANCE_LABELS[mark]}
                  </label>
                ))
              : checkType === 'CHECKLIST' ?
                <>
                  <label className="inline-flex items-center gap-0.5">
                    <input type="checkbox" checked={d.checklistOpened === true} onChange={() => update(row.employee.id, { checklistOpened: true, checklistIgnored: false })} />
                    Открыл
                  </label>
                  <label className="inline-flex items-center gap-0.5">
                    <input type="checkbox" checked={d.checklistOpened === false} onChange={() => update(row.employee.id, { checklistOpened: false })} />
                    Нет
                  </label>
                  <label className="inline-flex items-center gap-0.5">
                    <input type="checkbox" checked={d.checklistDone === true} onChange={() => update(row.employee.id, { checklistDone: true })} />
                    Выполнил
                  </label>
                  <label className="inline-flex items-center gap-0.5">
                    <input type="checkbox" checked={d.checklistIgnored === true} onChange={() => update(row.employee.id, { checklistIgnored: true })} />
                    Игнор
                  </label>
                </>
              : checkType === 'REPORT' ?
                <>
                  <label className="inline-flex items-center gap-0.5">
                    <input type="checkbox" checked={d.reportSubmitted === true} onChange={() => update(row.employee.id, { reportSubmitted: true, reportError: false })} />
                    Сдал
                  </label>
                  <label className="inline-flex items-center gap-0.5">
                    <input type="checkbox" checked={d.reportSubmitted === false} onChange={() => update(row.employee.id, { reportSubmitted: false })} />
                    Не сдал
                  </label>
                  <label className="inline-flex items-center gap-0.5">
                    <input type="checkbox" checked={d.reportError === true} onChange={() => update(row.employee.id, { reportError: true })} />
                    Ошибка
                  </label>
                </>
              : <Input
                  className="h-7 min-w-[8rem] flex-1 text-[11px]"
                  placeholder="Результат"
                  value={d.extraNote}
                  onChange={(e) => update(row.employee.id, { extraNote: e.target.value })}
                />}
              <Input
                className="h-7 min-w-[6rem] flex-1 text-[11px]"
                placeholder="Коммент."
                value={d.comment}
                onChange={(e) => update(row.employee.id, { comment: e.target.value })}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
