import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { dayKeyFromIso, scoreLabelRu, taskScoreOnDate, weekMondayKey } from '@/lib/task-week';
import { DAY_LABEL_RU } from '@/lib/task-days';
import type { Task } from '@/lib/types';

type Props = {
  tasks: Task[] | undefined;
  loading: boolean;
  viewWeek: string;
  diaryDate: string;
  onDiaryDateChange: (iso: string) => void;
  onAlignWeek: () => void;
};

export function EmployeeDiaryMarks({ tasks, loading, viewWeek, diaryDate, onDiaryDateChange, onAlignWeek }: Props) {
  const weekOfDay = weekMondayKey(diaryDate);
  const sameWeek = weekOfDay === weekMondayKey(viewWeek);
  const dayIdx = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].indexOf(dayKeyFromIso(diaryDate));
  const dayLabel = dayIdx >= 0 ? DAY_LABEL_RU[dayIdx] : '';

  const rows = (tasks ?? []).map((t) => ({
    task: t,
    score: taskScoreOnDate(t, diaryDate),
  }));

  return (
    <div className="rounded-xl border border-stroke/80 bg-black/[0.02] p-3 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted dark:text-white/45">
        Отметки из чек-листа сотрудника
      </div>
      <p className="mt-1 text-[12px] text-muted dark:text-white/50">
        То, что сотрудник отметил по ссылке «Дневник», попадает сюда и в таблицу «Неделя и баллы».
      </p>

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="grid gap-1 text-[12px] font-medium text-zinc-800 dark:text-white/85">
          День отчёта
          <Input type="date" className="max-w-[11rem]" value={diaryDate} onChange={(e) => onDiaryDateChange(e.target.value)} />
        </label>
        {!sameWeek ?
          <Button type="button" variant="outline" size="sm" onClick={onAlignWeek}>
            Показать неделю {weekOfDay}
          </Button>
        : null}
      </div>

      {sameWeek ?
        <p className="mt-2 text-[11px] uppercase tracking-[0.12em] text-muted dark:text-white/45">
          {dayLabel} · неделя с {viewWeek}
        </p>
      : null}

      {loading ?
        <Skeleton className="mt-3 h-20 w-full" />
      : !sameWeek ?
        <p className="mt-3 text-sm text-amber-700 dark:text-amber-200">
          Дата {diaryDate} в другой неделе. Нажмите «Показать неделю …» или смените неделю в вкладке «Неделя и баллы».
        </p>
      : rows.length === 0 ?
        <p className="mt-3 text-sm text-muted dark:text-white/55">На эту неделю задач нет — сотруднику нечего отмечать.</p>
      : (
        <ul className="mt-3 space-y-2">
          {rows.map(({ task, score }) => (
            <li
              key={task.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-stroke/60 px-3 py-2 dark:border-white/10"
            >
              <span className="text-[14px] font-medium text-zinc-900 dark:text-white">{task.title}</span>
              <span
                className={`text-[12px] font-semibold uppercase tracking-wide ${
                  score === 2 ? 'text-emerald-600' : score === 1 ? 'text-amber-600' : score === 0 ? 'text-rose-600' : 'text-muted'
                }`}
              >
                {scoreLabelRu(score)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
