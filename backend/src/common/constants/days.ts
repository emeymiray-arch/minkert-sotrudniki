export const WEEK_DAYS_DB = [
  'mon',
  'tue',
  'wed',
  'thu',
  'fri',
  'sat',
  'sun',
] as const;

export type WeekDayDb = (typeof WEEK_DAYS_DB)[number];

export const WEEK_DAY_LABEL_RU = [
  'ПН',
  'ВТ',
  'СР',
  'ЧТ',
  'ПТ',
  'СБ',
  'ВС',
] as const;
