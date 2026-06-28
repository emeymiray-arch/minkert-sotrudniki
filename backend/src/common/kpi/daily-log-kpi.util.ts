export type DailyLogMarks = {
  reportOnTime: boolean;
  planDone: boolean;
  noViolations: boolean;
  qualityOk: boolean;
};

export function dailyLogScore(log: DailyLogMarks | null | undefined): number {
  if (!log) return 0;
  const hits =
    (log.reportOnTime ? 1 : 0) +
    (log.planDone ? 1 : 0) +
    (log.noViolations ? 1 : 0) +
    (log.qualityOk ? 1 : 0);
  return (hits / 4) * 100;
}

export function weeklyScoresFromDailyLogs(
  logs: Array<{ date: Date; reportOnTime: boolean; planDone: boolean; noViolations: boolean; qualityOk: boolean }>,
  weekMonday: Date,
): { daily: number[]; weekly: number } {
  const byIso = new Map<string, DailyLogMarks>();
  for (const row of logs) {
    const iso = row.date.toISOString().slice(0, 10);
    byIso.set(iso, row);
  }
  const daily: number[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekMonday);
    d.setUTCDate(d.getUTCDate() + i);
    const iso = d.toISOString().slice(0, 10);
    daily.push(dailyLogScore(byIso.get(iso) ?? null));
  }
  const weekly =
    daily.reduce((sum, v) => sum + v, 0) / (daily.length || 1);
  return { daily, weekly };
}
