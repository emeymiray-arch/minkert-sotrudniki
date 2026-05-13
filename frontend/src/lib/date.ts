/** Понедельник текущей ISO-недели в формате YYYY-MM-DD (UTC-привязка как на бэкенде). */
export function utcMondayIso(date = new Date()): string {
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dow = utc.getUTCDay();
  const delta = dow === 0 ? -6 : 1 - dow;
  utc.setUTCDate(utc.getUTCDate() + delta);
  return utc.toISOString().slice(0, 10);
}
