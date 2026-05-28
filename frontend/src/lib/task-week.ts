import { utcMondayIso } from '@/lib/date';
import { clampTaskScore, type DayKey } from '@/lib/task-days';

/** Понедельник недели задачи (UTC, как на бэкенде). */
export function weekMondayKey(raw: unknown): string {
  if (raw == null || raw === '') return utcMondayIso();
  if (typeof raw === 'string') {
    const d = raw.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return utcMondayIso(new Date(`${d}T12:00:00.000Z`));
  }
  try {
    return utcMondayIso(new Date(raw as Date));
  } catch {
    return utcMondayIso();
  }
}

export function tasksForWeek<T extends { taskDate: unknown }>(tasks: T[], weekAnchor: string): T[] {
  const key = weekMondayKey(weekAnchor);
  return tasks.filter((t) => weekMondayKey(t.taskDate) === key);
}

/** Следующий понедельник после weekAnchor (YYYY-MM-DD). */
export function nextWeekMondayIso(weekAnchor: string): string {
  const d = new Date(`${weekMondayKey(weekAnchor)}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 7);
  return d.toISOString().slice(0, 10);
}

/** День недели для даты YYYY-MM-DD (как на бэкенде). */
export function dayKeyFromIso(dateIso: string): DayKey {
  const d = new Date(`${dateIso.slice(0, 10)}T12:00:00.000Z`);
  const map: DayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  return map[d.getUTCDay()]!;
}

/** Балл задачи за день; -1 если задача из другой недели. */
export function taskScoreOnDate(
  task: { taskDate: unknown } & Partial<Record<DayKey, number>>,
  dateIso: string,
): number {
  if (weekMondayKey(task.taskDate) !== weekMondayKey(dateIso)) return -1;
  const key = dayKeyFromIso(dateIso);
  return clampTaskScore(task[key]);
}

export function scoreLabelRu(score: number): string {
  if (score < 0) return '—';
  if (score === 0) return 'Не сделано';
  if (score === 1) return 'Частично';
  return 'Сделано';
}

/** Подписи дат на неделю якоря (ПН..ВС) в формате DD.MM */
export function weekDateLabels(weekAnchor: string): string[] {
  const monday = new Date(`${weekMondayKey(weekAnchor)}T12:00:00.000Z`);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setUTCDate(monday.getUTCDate() + i);
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    return `${dd}.${mm}`;
  });
}
