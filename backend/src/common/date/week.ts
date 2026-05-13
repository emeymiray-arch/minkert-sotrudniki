/** Понедельник ISO-недели в UTC для переданной даты (полуночь UTC). */
export function startUtcWeekMonday(date: InputDate): Date {
  const d = toUtcDate(date);
  const dow = d.getUTCDay(); /* 0=Вс … 6=Сб */
  const deltaToMonday = dow === 0 ? -6 : 1 - dow;
  d.setUTCDate(d.getUTCDate() + deltaToMonday);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** Конец месяца (последняя миллисекунда локального UTC календаря). */
export function endUtcMonth(date: InputDate): Date {
  const d = toUtcDate(date);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  return new Date(Date.UTC(y, m + 1, 0, 23, 59, 59, 999));
}

export function startUtcMonth(date: InputDate): Date {
  const d = toUtcDate(date);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0));
}

export type InputDate = string | Date;

export function addUtcDays(date: InputDate, days: number): Date {
  const d = toUtcDate(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export function addUtcMonths(date: InputDate, months: number): Date {
  const d = toUtcDate(date);
  const day = Math.min(d.getUTCDate(), 28); /* избежать переходов на месяце */
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const dim = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0);
  const last = new Date(dim).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d;
}

function toUtcDate(value: InputDate): Date {
  if (typeof value === 'string') return new Date(value);
  return new Date(value.getTime());
}
