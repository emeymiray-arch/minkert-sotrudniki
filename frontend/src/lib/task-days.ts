export const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type DayKey = (typeof DAY_KEYS)[number];

export const DAY_LABEL_RU = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'] as const;

export function nextStatus(current: number): 0 | 1 | 2 {
  const c = Number(current);
  if (c === 0) return 1;
  if (c === 1) return 2;
  return 0;
}
