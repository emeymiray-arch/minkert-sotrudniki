export const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type DayKey = (typeof DAY_KEYS)[number];

export const DAY_LABEL_RU = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'] as const;

/** Сетка: колонка задачи + 7 колонок фиксированной ширины (как ячейки баллов). */
export const WEEK_MATRIX_GRID_CLASS =
  'grid w-max min-w-full gap-2 [grid-template-columns:minmax(11rem,24rem)_repeat(7,3.5rem)]';

/** Левый верхний угол таблицы (подпись строк «задачи»). */
export const DAY_MATRIX_CORNER_CLASS =
  'box-border flex h-14 min-w-0 items-end rounded-lg border border-dashed border-stroke/80 bg-zinc-50/90 px-2 pb-1.5 dark:border-white/18 dark:bg-zinc-900/40';

/** Шапка дня: та же высота и скругление, что у балльной ячейки в режиме matrix (56×56 в колонке). */
export const DAY_HEADER_CELL_CLASS =
  'box-border flex h-14 w-full min-w-0 shrink-0 items-center justify-center rounded-lg border-2 border-zinc-400/75 bg-zinc-100 text-[13px] font-bold tabular-nums tracking-wide text-zinc-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] dark:border-white/35 dark:bg-zinc-700 dark:text-white dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]';

export function nextStatus(current: number): 0 | 1 | 2 {
  const c = Number(current);
  if (c === 0) return 1;
  if (c === 1) return 2;
  return 0;
}

export type TaskScore = 0 | 1 | 2;

/** Балл дня задачи: только 0, 1 или 2 (как на бэкенде). */
export function clampTaskScore(n: unknown): TaskScore {
  const x = Math.round(Number(n ?? 0));
  if (x >= 2) return 2;
  if (x <= 0) return 0;
  return 1;
}
