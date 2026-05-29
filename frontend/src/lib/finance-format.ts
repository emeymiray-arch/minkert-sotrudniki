/** Целое число из строки с запятыми/пробелами (223,666 → 223666). */
export function parseMoneyInput(raw: string): number {
  const digits = raw.replace(/[^\d]/g, '');
  if (!digits) return 0;
  const n = Number(digits);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

/** Отображение в ячейке: 223666 → 223,666; пусто при 0. */
export function formatMoneyDisplay(n: number): string {
  if (!n) return '';
  return n.toLocaleString('en-US');
}
