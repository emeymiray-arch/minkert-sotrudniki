export type CrmClientStatus = 'RED' | 'YELLOW' | 'GREEN' | 'BLUE' | 'BLACK';
export type CrmVisitStatus = 'SCHEDULED' | 'ARRIVED' | 'NO_SHOW' | 'RESCHEDULED' | 'CANCELED';

export type IntervalCompliance = {
  nextSequenceNumber: number;
  minIntervalDays: number;
  daysSinceLast: number | null;
  daysUntilAllowed: number | null;
  intervalOk: boolean;
  message: string;
};

export type CrmClient = {
  id: string;
  fullName: string;
  phone: string;
  note: string;
  status: CrmClientStatus;
  warned: boolean;
  discountPercent?: number;
  totalSpent: number;
  visitsCount: number;
  lastProcedureAt?: string | null;
  recommendedNextAt?: string | null;
  loyaltyStamps?: number | null;
  interval?: IntervalCompliance;
  lastProcedure?: {
    service: string;
    intervalDays: number;
    procedureDate: string;
    sequenceNumber: number;
  } | null;
  procedures?: Array<{ intervalDays: number; procedureDate: string; service: string }>;
};

export const STATUS_RU: Record<CrmClientStatus, string> = {
  RED: 'Не уведомлена',
  YELLOW: 'Уведомлена',
  GREEN: 'Записана',
  BLUE: 'Пришла',
  BLACK: 'Не пришла',
};

export const STATUS_CLASS: Record<CrmClientStatus, string> = {
  RED: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
  YELLOW: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  GREEN: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  BLUE: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  BLACK: 'bg-zinc-700/20 text-zinc-700 dark:text-zinc-200',
};

export const STATUS_CYCLE: CrmClientStatus[] = ['RED', 'YELLOW', 'GREEN', 'BLUE', 'BLACK'];

export function nextStatus(status: CrmClientStatus): CrmClientStatus {
  const idx = STATUS_CYCLE.indexOf(status);
  return STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length]!;
}

export function money(n: number) {
  return n.toLocaleString('ru-RU');
}
