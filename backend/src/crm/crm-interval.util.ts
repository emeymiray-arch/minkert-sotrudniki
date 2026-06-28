/** Минимальный интервал между процедурами: 1–3 → 25 дн., с 4-й → 35 дн. */
export function minIntervalDaysForSequence(sequenceNumber: number): number {
  if (sequenceNumber <= 0) return 0;
  if (sequenceNumber <= 3) return 25;
  return 35;
}

export function daysBetweenUtc(from: Date, to: Date): number {
  const a = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()),
  );
  const b = new Date(
    Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()),
  );
  return Math.floor((b.getTime() - a.getTime()) / 86_400_000);
}

export type IntervalCompliance = {
  nextSequenceNumber: number;
  minIntervalDays: number;
  daysSinceLast: number | null;
  daysUntilAllowed: number | null;
  intervalOk: boolean;
  message: string;
};

export function computeIntervalCompliance(
  visitsCount: number,
  lastProcedureAt: Date | null | undefined,
  referenceDate: Date = new Date(),
): IntervalCompliance {
  const nextSequenceNumber = visitsCount + 1;
  const minIntervalDays = minIntervalDaysForSequence(nextSequenceNumber);

  if (!lastProcedureAt || visitsCount === 0) {
    return {
      nextSequenceNumber,
      minIntervalDays,
      daysSinceLast: null,
      daysUntilAllowed: null,
      intervalOk: true,
      message:
        nextSequenceNumber === 1
          ? 'Первая процедура — интервал не требуется.'
          : 'Нет данных о прошлой процедуре.',
    };
  }

  const daysSinceLast = daysBetweenUtc(lastProcedureAt, referenceDate);
  const daysUntilAllowed = Math.max(0, minIntervalDays - daysSinceLast);
  const intervalOk = daysSinceLast >= minIntervalDays;

  const range =
    nextSequenceNumber <= 3
      ? '25–30 дней (процедуры 1–3)'
      : 'от 35 дней (с 4-й процедуры)';

  return {
    nextSequenceNumber,
    minIntervalDays,
    daysSinceLast,
    daysUntilAllowed,
    intervalOk,
    message: intervalOk
      ? `Прошло ${daysSinceLast} дн. — можно записывать (минимум ${minIntervalDays} дн., ${range}).`
      : `Рано: прошло ${daysSinceLast} дн., нужно минимум ${minIntervalDays} (ещё ${daysUntilAllowed} дн.). ${range}.`,
  };
}
