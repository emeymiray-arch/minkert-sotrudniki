import type { OpsTimeBlock } from '@/operations/types';

export const OPS_SORT_CATEGORIES = [
  'Дисциплина сотрудников',
  'Проверка отчётов',
  'Контент',
  'Аналитика',
  'Сотрудники',
  'Расходники',
] as const;

/** Порядок типов фиксации в выпадающем списке. */
export const OPS_CHECK_TYPE_ORDER = ['ATTENDANCE', 'NONE', 'CHECKLIST', 'REPORT', 'GENERIC'] as const;

export const OPS_NAV = [
  { to: '/upravlenie/utro', label: 'Утро', block: 'MORNING' as OpsTimeBlock },
  { to: '/upravlenie/den', label: 'День', block: 'DAY' as OpsTimeBlock },
  { to: '/upravlenie/vecher', label: 'Вечер', block: 'EVENING' as OpsTimeBlock },
  { to: '/upravlenie/sleduyushchiy-den', label: 'След. день', block: 'NEXT_DAY' as OpsTimeBlock },
  { to: '/upravlenie/nedelya', label: 'Неделя', block: 'WEEK' as OpsTimeBlock },
  { to: '/upravlenie/sotrudniki', label: 'Сотрудники' },
  { to: '/upravlenie/zhurnal', label: 'Журнал' },
  { to: '/upravlenie/narusheniya', label: 'Нарушения' },
  { to: '/upravlenie/problemy', label: 'Проблемы' },
  { to: '/upravlenie/kontent', label: 'Контент' },
  { to: '/upravlenie/analitika', label: 'Аналитика' },
  { to: '/upravlenie/nastroyki', label: 'Настройки' },
] as const;

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
