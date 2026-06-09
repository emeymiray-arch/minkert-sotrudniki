import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const MONTHS_RU = [
  'ЯНВАРЬ',
  'ФЕВРАЛЬ',
  'МАРТ',
  'АПРЕЛЬ',
  'МАЙ',
  'ИЮНЬ',
  'ИЮЛЬ',
  'АВГУСТ',
  'СЕНТЯБРЬ',
  'ОКТЯБРЬ',
  'НОЯБРЬ',
  'ДЕКАБРЬ',
] as const;

export type FinancePeriod = 'month' | 'week' | 'halfyear' | 'year';

function parseDateParam(raw?: string): Date {
  if (!raw?.trim()) {
    const n = new Date();
    return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), 1));
  }
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(raw.trim());
  if (!m) throw new BadRequestException('Дата: YYYY-MM или YYYY-MM-DD');
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = m[3] ? Number(m[3]) : 1;
  return new Date(Date.UTC(y, mo - 1, d));
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
}

type DayEntry = {
  date: string;
  revenue: number;
  revenueNoDiscount: number;
  expenses: number;
  discounts: number;
  salary: number;
  net: number;
  clientCount: number;
};

@Injectable()
export class OperationsFinanceService {
  constructor(private readonly prisma: PrismaService) {}

  async upsertDay(body: {
    date: string;
    revenue?: number;
    revenueNoDiscount?: number;
    expenses?: number;
    discounts?: number;
    salary?: number;
    net?: number;
    clientCount?: number;
  }) {
    const d = parseDateParam(body.date);
    const existing = await this.prisma.opsFinanceDay.findUnique({ where: { date: d } });
    const revenue = body.revenue !== undefined ? Math.round(body.revenue) : (existing?.revenue ?? 0);
    const revenueNoDiscount =
      body.revenueNoDiscount !== undefined ?
        Math.round(body.revenueNoDiscount)
      : (existing?.revenueNoDiscount ?? revenue);
    const discounts = body.discounts !== undefined ? Math.round(body.discounts) : (existing?.discounts ?? 0);
    const salary = body.salary !== undefined ? Math.round(body.salary) : (existing?.salary ?? 0);
    const expenses = body.expenses !== undefined ? Math.round(body.expenses) : (existing?.expenses ?? 0);
    const clientCount =
      body.clientCount !== undefined ? Math.round(body.clientCount) : (existing?.clientCount ?? 0);
    const net = revenueNoDiscount - salary - discounts - expenses;

    const row = await this.prisma.opsFinanceDay.upsert({
      where: { date: d },
      create: { date: d, revenue, revenueNoDiscount, expenses, discounts, salary, net, clientCount },
      update: { revenue, revenueNoDiscount, expenses, discounts, salary, net, clientCount },
    });
    return {
      date: isoDate(row.date),
      revenue: row.revenue,
      revenueNoDiscount: row.revenueNoDiscount,
      expenses: row.expenses,
      discounts: row.discounts,
      salary: row.salary,
      clientCount: row.clientCount,
      net: row.net,
    };
  }

  private async loadRange(from: Date, to: Date): Promise<Map<string, DayEntry>> {
    const rows = await this.prisma.opsFinanceDay.findMany({
      where: { date: { gte: from, lte: to } },
    });
    const map = new Map<string, DayEntry>();
    for (const r of rows) {
      map.set(isoDate(r.date), {
        date: isoDate(r.date),
        revenue: r.revenue,
        revenueNoDiscount: r.revenueNoDiscount,
        expenses: r.expenses,
        discounts: r.discounts,
        salary: r.salary,
        net: r.net,
        clientCount: r.clientCount,
      });
    }
    return map;
  }

  private emptyDay(date: string): DayEntry {
    return {
      date,
      revenue: 0,
      revenueNoDiscount: 0,
      expenses: 0,
      discounts: 0,
      salary: 0,
      net: 0,
      clientCount: 0,
    };
  }

  private buildRows(
    columns: Array<{ key: string; date: string; label: string }>,
    getEntry: (col: { date: string }) => DayEntry,
  ) {
    const revenueVals = columns.map((c) => getEntry(c).revenue);
    const salaryVals = columns.map((c) => getEntry(c).salary);
    const discountVals = columns.map((c) => getEntry(c).discounts);
    const expenseVals = columns.map((c) => getEntry(c).expenses);
    const netVals = columns.map((c) => getEntry(c).net);
    const clientVals = columns.map((c) => getEntry(c).clientCount);

    const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);

    return [
      { key: 'revenue', label: 'Общая выручка', values: revenueVals, total: sum(revenueVals) },
      { key: 'salary', label: 'ЗП', values: salaryVals, total: sum(salaryVals) },
      { key: 'discounts', label: 'Скидки', values: discountVals, total: sum(discountVals) },
      { key: 'expenses', label: 'Расходы', values: expenseVals, total: sum(expenseVals) },
      { key: 'net', label: 'Выручка без всех расходов', values: netVals, total: sum(netVals) },
      { key: 'clients', label: 'Клиентки', values: clientVals, total: sum(clientVals) },
    ];
  }

  /** Итого под каждым столбцом (для месяца — по дням). */
  private columnFooters(columns: Array<{ date: string }>, getEntry: (date: string) => DayEntry) {
    return columns.map((col) => {
      const e = getEntry(col.date);
      return {
        date: col.date,
        revenue: e.revenue,
        expenses: e.expenses,
        discounts: e.discounts,
        salary: e.salary,
        net: e.net,
        clientCount: e.clientCount,
      };
    });
  }

  async getTable(period: FinancePeriod, anchorRaw?: string) {
    const anchor = parseDateParam(anchorRaw);
    const y = anchor.getUTCFullYear();
    const m = anchor.getUTCMonth();

    if (period === 'month') {
      const dim = daysInMonth(y, m);
      const from = new Date(Date.UTC(y, m, 1));
      const to = new Date(Date.UTC(y, m, dim));
      const map = await this.loadRange(from, to);

      const columns = Array.from({ length: dim }, (_, i) => {
        const day = i + 1;
        const date = isoDate(new Date(Date.UTC(y, m, day)));
        return { key: date, date, label: String(day) };
      });

      const getEntry = (col: { date: string }) => map.get(col.date) ?? this.emptyDay(col.date);
      const rows = this.buildRows(columns, getEntry);
      const footers = this.columnFooters(columns, (d) => map.get(d) ?? this.emptyDay(d));

      return {
        period,
        title: `${MONTHS_RU[m]} ${y}`,
        anchor: isoDate(from),
        columns,
        rows,
        columnFooters: footers,
        grandTotal: {
          revenue: rows[0]!.total,
          salary: rows[1]!.total,
          discounts: rows[2]!.total,
          expenses: rows[3]!.total,
          net: rows[4]!.total,
          clientCount: rows[5]!.total,
        },
      };
    }

    if (period === 'week') {
      const from = new Date(anchor);
      const columns: Array<{ key: string; date: string; label: string }> = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(from);
        d.setUTCDate(d.getUTCDate() + i);
        const label = `${d.getUTCDate()}.${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
        columns.push({ key: isoDate(d), date: isoDate(d), label });
      }
      const to = parseDateParam(columns[6]!.date);
      const map = await this.loadRange(from, to);
      const getEntry = (col: { date: string }) => map.get(col.date) ?? this.emptyDay(col.date);
      const rows = this.buildRows(columns, getEntry);
      const footers = this.columnFooters(columns, (d) => map.get(d) ?? this.emptyDay(d));
      return {
        period,
        title: `Неделя · ${columns[0]!.label}–${columns[6]!.label} ${MONTHS_RU[m]} ${y}`,
        anchor: isoDate(from),
        columns,
        rows,
        columnFooters: footers,
        grandTotal: {
          revenue: rows[0]!.total,
          salary: rows[1]!.total,
          discounts: rows[2]!.total,
          expenses: rows[3]!.total,
          net: rows[4]!.total,
          clientCount: rows[5]!.total,
        },
      };
    }

    if (period === 'halfyear') {
      const columns: Array<{ key: string; date: string; label: string }> = [];
      for (let i = 0; i < 6; i++) {
        const mm = m + i;
        const yy = y + Math.floor(mm / 12);
        const mi = mm % 12;
        const from = new Date(Date.UTC(yy, mi, 1));
        const to = new Date(Date.UTC(yy, mi, daysInMonth(yy, mi)));
        columns.push({
          key: isoDate(from),
          date: isoDate(from),
          label: `${MONTHS_RU[mi]!.slice(0, 3)} ${yy}`,
        });
      }

      const from = parseDateParam(columns[0]!.date);
      const lastCol = columns[5]!;
      const lastAnchor = parseDateParam(lastCol.date);
      const to = new Date(
        Date.UTC(
          lastAnchor.getUTCFullYear(),
          lastAnchor.getUTCMonth(),
          daysInMonth(lastAnchor.getUTCFullYear(), lastAnchor.getUTCMonth()),
        ),
      );
      const map = await this.loadRange(from, to);

      const aggregate = (startIso: string) => {
        const start = parseDateParam(startIso);
        const yy = start.getUTCFullYear();
        const mi = start.getUTCMonth();
        const dim = daysInMonth(yy, mi);
        let revenue = 0;
        let revenueNoDiscount = 0;
        let expenses = 0;
        let discounts = 0;
        let salary = 0;
        let net = 0;
        let clientCount = 0;
        for (let d = 1; d <= dim; d++) {
          const e = map.get(isoDate(new Date(Date.UTC(yy, mi, d)))) ?? this.emptyDay('');
          revenue += e.revenue;
          revenueNoDiscount += e.revenueNoDiscount;
          expenses += e.expenses;
          discounts += e.discounts;
          salary += e.salary;
          net += e.net;
          clientCount += e.clientCount;
        }
        return { date: startIso, revenue, revenueNoDiscount, expenses, discounts, salary, net, clientCount };
      };

      const getEntry = (col: { date: string }) => aggregate(col.date);
      const aggCols = columns.map((c) => ({ date: c.date }));
      const rows = this.buildRows(
        columns,
        (col) => getEntry(col),
      );
      const footers = aggCols.map((c) => {
        const e = getEntry({ date: c.date });
        return {
          date: c.date,
          revenue: e.revenue,
          expenses: e.expenses,
          discounts: e.discounts,
          salary: e.salary,
          net: e.net,
          clientCount: e.clientCount,
        };
      });

      const half = m < 6 ? '1-е полугодие' : '2-е полугодие';
      return {
        period,
        title: `${half} ${y}`,
        anchor: isoDate(new Date(Date.UTC(y, m, 1))),
        columns,
        rows,
        columnFooters: footers,
        grandTotal: {
          revenue: rows[0]!.total,
          salary: rows[1]!.total,
          discounts: rows[2]!.total,
          expenses: rows[3]!.total,
          net: rows[4]!.total,
          clientCount: rows[5]!.total,
        },
      };
    }

    /* year: 12 months */
    const columns = Array.from({ length: 12 }, (_, mi) => {
      const from = new Date(Date.UTC(y, mi, 1));
      return {
        key: isoDate(from),
        date: isoDate(from),
        label: MONTHS_RU[mi]!.slice(0, 3),
      };
    });
    const from = new Date(Date.UTC(y, 0, 1));
    const to = new Date(Date.UTC(y, 11, daysInMonth(y, 11)));
    const map = await this.loadRange(from, to);

    const aggregateMonth = (startIso: string) => {
      const start = parseDateParam(startIso);
      const yy = start.getUTCFullYear();
      const mi = start.getUTCMonth();
      const dim = daysInMonth(yy, mi);
      let revenue = 0;
      let revenueNoDiscount = 0;
      let expenses = 0;
      let discounts = 0;
      let salary = 0;
      let net = 0;
      let clientCount = 0;
      for (let d = 1; d <= dim; d++) {
        const e = map.get(isoDate(new Date(Date.UTC(yy, mi, d)))) ?? this.emptyDay('');
        revenue += e.revenue;
        revenueNoDiscount += e.revenueNoDiscount;
        expenses += e.expenses;
        discounts += e.discounts;
        salary += e.salary;
        net += e.net;
        clientCount += e.clientCount;
      }
      return { date: startIso, revenue, revenueNoDiscount, expenses, discounts, salary, net, clientCount };
    };

    const rows = this.buildRows(columns, (col) => aggregateMonth(col.date));
    const footers = columns.map((c) => {
      const e = aggregateMonth(c.date);
      return {
        date: c.date,
        revenue: e.revenue,
        expenses: e.expenses,
        discounts: e.discounts,
        salary: e.salary,
        net: e.net,
        clientCount: e.clientCount,
      };
    });

    return {
      period,
      title: `${y} год`,
      anchor: isoDate(from),
      columns,
      rows,
      columnFooters: footers,
      grandTotal: {
        revenue: rows[0]!.total,
        salary: rows[1]!.total,
        discounts: rows[2]!.total,
        expenses: rows[3]!.total,
        net: rows[4]!.total,
        clientCount: rows[5]!.total,
      },
    };
  }

  async listExpenses(dateRaw: string) {
    const d = parseDateParam(dateRaw);
    return this.prisma.opsFinanceExpenseItem.findMany({
      where: { date: d },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addExpense(body: { date: string; title: string; amount: number }) {
    const d = parseDateParam(body.date);
    const title = body.title?.trim();
    if (!title) throw new BadRequestException('Название расхода обязательно');
    const row = await this.prisma.opsFinanceExpenseItem.create({
      data: { date: d, title, amount: Math.max(0, Math.round(body.amount)) },
    });
    await this.syncFromProcedures(body.date);
    return row;
  }

  async removeExpense(id: string) {
    const row = await this.prisma.opsFinanceExpenseItem.findUnique({ where: { id } });
    if (!row) throw new BadRequestException('Расход не найден');
    await this.prisma.opsFinanceExpenseItem.delete({ where: { id } });
    await this.syncFromProcedures(isoDate(row.date));
    return { ok: true };
  }

  /** Пересчёт дня из CRM-процедур и строк расходов. */
  async syncFromProcedures(dateRaw?: string) {
    const d = parseDateParam(dateRaw ?? isoDate(new Date()));
    const dateIso = isoDate(d);

    const procedures = await this.prisma.crmProcedure.findMany({
      where: { procedureDate: d },
    });

    const revenueGross = procedures.reduce(
      (s, p) => s + ((p.basePrice || 0) + (p.extraCost || 0) || p.cost),
      0,
    );
    const revenue = revenueGross;
    const discounts = procedures.reduce((s, p) => s + p.discountAmount, 0);
    const salary = procedures.reduce((s, p) => s + p.masterSalary, 0);
    const clientCount = procedures.length;

    const expenseItems = await this.prisma.opsFinanceExpenseItem.findMany({ where: { date: d } });
    const expenses = expenseItems.reduce((s, e) => s + e.amount, 0);
    const net = revenueGross - salary - discounts - expenses;

    const row = await this.prisma.opsFinanceDay.upsert({
      where: { date: d },
      create: {
        date: d,
        revenue,
        revenueNoDiscount: revenueGross,
        discounts,
        salary,
        expenses,
        net,
        clientCount,
      },
      update: { revenue, revenueNoDiscount: revenueGross, discounts, salary, expenses, net, clientCount },
    });

    return {
      date: dateIso,
      revenue: row.revenue,
      discounts: row.discounts,
      salary: row.salary,
      expenses: row.expenses,
      net: row.net,
      clientCount: row.clientCount,
      expenseItems,
    };
  }
}
