import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { apiJson } from '@/lib/http';
import { dayKeyFromIso, scoreLabelRu, tasksForWeek, taskScoreOnDate, weekMondayKey } from '@/lib/task-week';
import { DAY_LABEL_RU } from '@/lib/task-days';
import type { Task } from '@/lib/types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type Props = {
  employeeId: string;
  allTasks: Task[] | undefined;
  loading: boolean;
  diaryDate: string;
  onDiaryDateChange: (iso: string) => void;
  canEditMarks: boolean;
};

export function EmployeeDiaryMarks({
  employeeId,
  allTasks,
  loading,
  diaryDate,
  onDiaryDateChange,
  canEditMarks,
}: Props) {
  const qc = useQueryClient();
  const diaryWeek = weekMondayKey(diaryDate);
  const weekTasks = tasksForWeek(allTasks ?? [], diaryWeek);
  const dayKey = dayKeyFromIso(diaryDate);
  const dayIdx = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].indexOf(dayKey);
  const dayLabel = dayIdx >= 0 ? DAY_LABEL_RU[dayIdx] : '';

  const patchScore = useMutation({
    mutationFn: async (args: { taskId: string; score: number }) =>
      apiJson<Task>(`/tasks/${args.taskId}`, {
        method: 'PATCH',
        body: JSON.stringify({ days: { [dayKey]: args.score } }),
      }),
    onSuccess: async () => {
      toast.success('Отметка сохранена');
      await qc.invalidateQueries({ queryKey: ['employee-tasks', employeeId] });
      await qc.invalidateQueries({ queryKey: ['employees'] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Не сохранилось'),
  });

  return (
    <div className="rounded-xl border border-stroke/80 bg-black/[0.02] p-3 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted dark:text-white/45">
        Дневник — отметки из чек-листа
      </div>
      <p className="mt-1 text-[12px] text-muted dark:text-white/50">
        Здесь только ответы сотрудника по ссылке (и ваши правки). Задачи на неделю задаёте во вкладке «Неделя и баллы».
      </p>

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="grid gap-1 text-[12px] font-medium text-zinc-800 dark:text-white/85">
          День отчёта
          <Input type="date" className="max-w-[11rem]" value={diaryDate} onChange={(e) => onDiaryDateChange(e.target.value)} />
        </label>
      </div>

      <p className="mt-2 text-[11px] uppercase tracking-[0.12em] text-muted dark:text-white/45">
        {dayLabel} · неделя с {diaryWeek}
      </p>

      {loading ?
        <Skeleton className="mt-3 h-20 w-full" />
      : weekTasks.length === 0 ?
        <p className="mt-3 text-sm text-muted dark:text-white/55">
          На неделю {diaryWeek} нет задач. Создайте их во вкладке «Неделя и баллы» (та же неделя, что у сотрудника в чек-листе).
        </p>
      : (
        <ul className="mt-3 space-y-3">
          {weekTasks.map((task) => {
            const score = taskScoreOnDate(task, diaryDate);
            const s = score < 0 ? 0 : score;
            return (
              <li key={task.id} className="rounded-lg border border-stroke/60 px-3 py-2 dark:border-white/10">
                <div className="text-[14px] font-medium text-zinc-900 dark:text-white">{task.title}</div>
                {canEditMarks ?
                  <div className="mt-2 flex flex-wrap gap-2">
                    {([0, 1, 2] as const).map((v) => (
                      <Button
                        key={v}
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={patchScore.isPending}
                        className={cn(
                          'min-w-[5.5rem]',
                          s === v && 'border-accent bg-accent/15 text-accent dark:bg-accent/20',
                        )}
                        onClick={() => {
                          if (s === v) return;
                          patchScore.mutate({ taskId: task.id, score: v });
                        }}
                      >
                        {scoreLabelRu(v)}
                      </Button>
                    ))}
                  </div>
                : (
                  <span
                    className={`mt-2 inline-block text-[12px] font-semibold uppercase tracking-wide ${
                      s === 2 ? 'text-emerald-600' : s === 1 ? 'text-amber-600' : 'text-rose-600'
                    }`}
                  >
                    {scoreLabelRu(s)}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
