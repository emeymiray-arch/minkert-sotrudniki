import { utcMondayIso } from '@/lib/date';

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
