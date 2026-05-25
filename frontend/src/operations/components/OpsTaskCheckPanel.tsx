import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, Save } from 'lucide-react';
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

function entryToDraft(
  employeeId: string,
  entry: OpsCheckSheet['rows'][0]['entry'],
): RowDraft {
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
  onSaved?: () => void;
};

export function OpsTaskCheckPanel({ taskId, recordDate, checkType, onSaved }: Props) {
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
      toast.success('Журнал фиксации сохранён');
      void qc.invalidateQueries({ queryKey: ['ops', 'check-sheet', taskId, recordDate] });
      onSaved?.();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Ошибка сохранения'),
  });

  if (sheetQ.isLoading) return <Skeleton className="mt-2 h-[120px]" />;
  if (!sheetQ.data) return null;

  const update = (employeeId: string, patch: Partial<RowDraft>) => {
    setDrafts((prev) => prev.map((d) => (d.employeeId === employeeId ? { ...d, ...patch } : d)));
  };

  return (
    <div className="mt-2 rounded-lg border border-accent/25 bg-accent/[0.04] p-3 dark:border-accent/30 dark:bg-accent/[0.06]">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-800 dark:text-white/85">
          <ClipboardList className="size-4 text-accent" />
          Фиксация · {CHECK_TYPE_LABEL[checkType]}
        </div>
        <Button type="button" size="sm" disabled={saveMu.isPending} onClick={() => saveMu.mutate()}>
          <Save className="mr-1 size-3.5" />
          Сохранить журнал
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-stroke/80 text-[10px] uppercase tracking-wider text-muted dark:border-white/10 dark:text-white/45">
              <th className="py-2 pr-3 font-semibold">Сотрудник</th>
              {checkType === 'ATTENDANCE' ?
                Object.values(ATTENDANCE_LABELS).map((l) => (
                  <th key={l} className="px-1 py-2 font-semibold">
                    {l}
                  </th>
                ))
              : checkType === 'CHECKLIST' ?
                <>
                  <th className="px-1 py-2">Открыл</th>
                  <th className="px-1 py-2">Не открыл</th>
                  <th className="px-1 py-2">Выполнил</th>
                  <th className="px-1 py-2">Игнор</th>
                </>
              : checkType === 'REPORT' ?
                <>
                  <th className="px-1 py-2">Сдал</th>
                  <th className="px-1 py-2">Не сдал</th>
                  <th className="px-1 py-2">Ошибка</th>
                  <th className="px-1 py-2">Исправить</th>
                </>
              : <th className="px-1 py-2">Результат</th>}
              <th className="px-1 py-2">Комментарий</th>
            </tr>
          </thead>
          <tbody>
            {sheetQ.data.rows.map((row) => {
              const d = drafts.find((x) => x.employeeId === row.employee.id);
              if (!d) return null;
              return (
                <tr key={row.employee.id} className="border-b border-stroke/50 dark:border-white/[0.06]">
                  <td className="py-2 pr-3 font-medium text-zinc-900 dark:text-white">{row.employee.name}</td>
                  {checkType === 'ATTENDANCE' ?
                    (Object.keys(ATTENDANCE_LABELS) as OpsAttendanceMark[]).map((mark) => (
                      <td key={mark} className="px-1 py-2 text-center">
                        <input
                          type="radio"
                          name={`att-${row.employee.id}`}
                          checked={d.attendanceMark === mark}
                          onChange={() => update(row.employee.id, { attendanceMark: mark })}
                          className="size-3.5 accent-[hsl(var(--accent))]"
                        />
                      </td>
                    ))
                  : checkType === 'CHECKLIST' ?
                    <>
                      <td className="px-1 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={d.checklistOpened === true}
                          onChange={() =>
                            update(row.employee.id, {
                              checklistOpened: true,
                              checklistIgnored: false,
                            })
                          }
                        />
                      </td>
                      <td className="px-1 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={d.checklistOpened === false}
                          onChange={() =>
                            update(row.employee.id, {
                              checklistOpened: false,
                              checklistIgnored: false,
                            })
                          }
                        />
                      </td>
                      <td className="px-1 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={d.checklistDone === true}
                          onChange={() => update(row.employee.id, { checklistDone: true })}
                        />
                      </td>
                      <td className="px-1 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={d.checklistIgnored === true}
                          onChange={() =>
                            update(row.employee.id, {
                              checklistIgnored: true,
                              checklistOpened: null,
                            })
                          }
                        />
                      </td>
                    </>
                  : checkType === 'REPORT' ?
                    <>
                      <td className="px-1 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={d.reportSubmitted === true}
                          onChange={() =>
                            update(row.employee.id, {
                              reportSubmitted: true,
                              reportError: false,
                            })
                          }
                        />
                      </td>
                      <td className="px-1 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={d.reportSubmitted === false}
                          onChange={() => update(row.employee.id, { reportSubmitted: false })}
                        />
                      </td>
                      <td className="px-1 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={d.reportError === true}
                          onChange={() => update(row.employee.id, { reportError: true })}
                        />
                      </td>
                      <td className="px-1 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={d.reportNeedsFix === true}
                          onChange={() => update(row.employee.id, { reportNeedsFix: true })}
                        />
                      </td>
                    </>
                  : <td className="px-1 py-2">
                      <Input
                        className="h-8 text-xs"
                        placeholder="Результат…"
                        value={d.extraNote}
                        onChange={(e) => update(row.employee.id, { extraNote: e.target.value })}
                      />
                    </td>}
                  <td className="px-1 py-2">
                    <Input
                      className="h-8 min-w-[120px] text-xs"
                      placeholder="Комментарий"
                      value={d.comment}
                      onChange={(e) => update(row.employee.id, { comment: e.target.value })}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
