export const SCHEDULE_DAY_START_HOUR = 10;
export const SCHEDULE_DAY_END_HOUR = 20;
export const SCHEDULE_SLOT_MINUTES = 60;
export const APPOINTMENT_DURATION_MINUTES = 60;

export function parseScheduleDate(dateRaw: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateRaw.trim());
  if (!m) throw new Error('date: YYYY-MM-DD');
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

export function buildDaySlotStarts(date: Date): Date[] {
  const slots: Date[] = [];
  for (let h = SCHEDULE_DAY_START_HOUR; h < SCHEDULE_DAY_END_HOUR; h++) {
    slots.push(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), h, 0, 0)));
  }
  return slots;
}

export function formatSlotLabel(d: Date): string {
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

export function slotEnd(start: Date): Date {
  return new Date(start.getTime() + SCHEDULE_SLOT_MINUTES * 60_000);
}

export function appointmentOverlapsSlot(
  slotStart: Date,
  apptStart: Date,
  durationMin = APPOINTMENT_DURATION_MINUTES,
): boolean {
  const slotFinish = slotEnd(slotStart);
  const apptEnd = new Date(apptStart.getTime() + durationMin * 60_000);
  return apptStart < slotFinish && apptEnd > slotStart;
}

/** Запись показываем только в слоте, где она начинается (без дубля в следующем часе). */
export function appointmentStartsInSlot(slotStart: Date, apptStart: Date): boolean {
  const slotFinish = slotEnd(slotStart);
  return apptStart >= slotStart && apptStart < slotFinish;
}
