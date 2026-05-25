import type { OpsTaskCheckType } from '@/operations/types';

export const CHECK_TYPE_LABEL: Record<OpsTaskCheckType, string> = {
  NONE: 'Заметка',
  ATTENDANCE: 'Явка',
  CHECKLIST: 'Чек-листы',
  REPORT: 'Отчёты',
  GENERIC: 'Проверка',
};

export const ATTENDANCE_LABELS = {
  PRESENT: 'Пришёл',
  LATE: 'Опоздал',
  ABSENT: 'Отсутствует',
  WARNED: 'Предупредил',
} as const;
