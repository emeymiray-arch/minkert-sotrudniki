import { WeekDayDb, WEEK_DAYS_DB } from '../constants/days';

export type TaskDayValues = Record<WeekDayDb, number>;

export function clampStatus(v: unknown): 0 | 1 | 2 {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return 0;
  if (n >= 2) return 2;
  if (n >= 1) return 1;
  return 0;
}

/** 0% / 100% / 115% (перевыполнение) для одной ячейки дня и задачи */
export function percentForStatus(status: number): number {
  const s = clampStatus(status);
  if (s === 0) return 0;
  if (s === 1) return 100;
  return 115;
}

/** Средний KPI задачи по дням недели (строчная часть задачи за неделю) */
export function taskWeekEfficiencyPercent(task: TaskDayValues): number {
  const scores = WEEK_DAYS_DB.map((d) => percentForStatus(task[d]));
  if (scores.length === 0) return 0;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

/** Суммарные «балла» задачи по неделе для нормировки (макс если все перевыполнения) */
export function taskWeekMaxPossible(): number {
  return 115 * WEEK_DAYS_DB.length;
}

/** Суммарные баллы задачи по неделе */
export function taskWeekRawScore(task: TaskDayValues): number {
  return WEEK_DAYS_DB.reduce((sum, d) => sum + percentForStatus(task[d]), 0);
}

/** Серия недель подряд, где недельная эффективность >= порога */
export function weeklyStreak(weeklyPercentsDescendingNewestFirst: number[], threshold = 78): number {
  let streak = 0;
  for (const w of weeklyPercentsDescendingNewestFirst) {
    if (w >= threshold) streak += 1;
    else break;
  }
  return streak;
}
