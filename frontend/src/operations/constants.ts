export const OPS_NAV = [{ to: '/upravlenie', label: 'Задачи' }] as const;

export const OPS_SORT_CATEGORIES = [
  'Дисциплина',
  'Финансы',
  'CRM',
  'Маркетинг',
  'Склад',
  'Персонал',
] as const;

export const OPS_CHECK_TYPE_ORDER = ['NONE', 'GENERIC'] as const;

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
