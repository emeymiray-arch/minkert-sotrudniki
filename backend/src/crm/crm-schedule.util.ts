export const SCHEDULE_DAY_START_HOUR = 9;
export const SCHEDULE_DAY_END_HOUR = 20;
export const MIN_APPOINTMENT_DURATION_MINUTES = 5;
export const MAX_APPOINTMENT_DURATION_MINUTES = 8 * 60;
export const DEFAULT_APPOINTMENT_DURATION_MINUTES = 60;

export function parseScheduleDate(dateRaw: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateRaw.trim());
  if (!m) throw new Error('date: YYYY-MM-DD');
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

export function formatSlotLabel(d: Date): string {
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

export function appointmentEndsAt(
  startsAt: Date,
  durationMinutes: number,
): Date {
  return new Date(startsAt.getTime() + durationMinutes * 60_000);
}

export function formatTimeRange(start: Date, end: Date): string {
  return `${formatSlotLabel(start)}–${formatSlotLabel(end)}`;
}

export function appointmentsOverlap(
  aStart: Date,
  aDurationMin: number,
  bStart: Date,
  bDurationMin: number,
): boolean {
  const aEnd = appointmentEndsAt(aStart, aDurationMin);
  const bEnd = appointmentEndsAt(bStart, bDurationMin);
  return aStart < bEnd && aEnd > bStart;
}

export function normalizeDurationMinutes(raw?: number | null): number {
  const n = Math.round(Number(raw ?? DEFAULT_APPOINTMENT_DURATION_MINUTES));
  if (!Number.isFinite(n)) return DEFAULT_APPOINTMENT_DURATION_MINUTES;
  return Math.min(
    MAX_APPOINTMENT_DURATION_MINUTES,
    Math.max(MIN_APPOINTMENT_DURATION_MINUTES, n),
  );
}
