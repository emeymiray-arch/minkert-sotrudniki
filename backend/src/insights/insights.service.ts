import { Injectable } from '@nestjs/common';
import { AnalyticsService } from '../analytics/analytics.service';
import {
  addUtcDays,
  endUtcMonth,
  startUtcMonth,
  startUtcWeekMonday,
} from '../common/date/week';
import {
  paginatedResult,
  parsePagination,
} from '../common/pagination/pagination.util';
import { CrmService } from '../crm/crm.service';
import { OperationsFinanceService } from '../operations/operations-finance.service';
import { OperationsService } from '../operations/operations.service';
import { PrismaService } from '../prisma/prisma.service';

type MonthPlan = { revenuePlan?: number; clientPlan?: number };
type BusinessPlans = Record<string, MonthPlan>;

function utcToday() {
  const n = new Date();
  return new Date(
    Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()),
  );
}

function monthKey(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function pct(actual: number, plan: number) {
  if (!plan) return 0;
  return Math.round((actual / plan) * 100);
}

function normalizePhone(raw: string) {
  return raw.replace(/\D/g, '');
}

@Injectable()
export class InsightsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly analytics: AnalyticsService,
    private readonly ops: OperationsService,
    private readonly finance: OperationsFinanceService,
    private readonly crm: CrmService,
  ) {}

  private async getPlans(): Promise<BusinessPlans> {
    const row = await this.prisma.opsSettings.findUnique({
      where: { id: 'default' },
    });
    const raw = row?.businessPlans;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    return raw as BusinessPlans;
  }

  async setPlan(
    month: string,
    body: { revenuePlan?: number; clientPlan?: number },
  ) {
    const plans = await this.getPlans();
    const prev = plans[month] ?? {};
    plans[month] = {
      revenuePlan:
        body.revenuePlan !== undefined
          ? Math.max(0, Math.round(body.revenuePlan))
          : prev.revenuePlan,
      clientPlan:
        body.clientPlan !== undefined
          ? Math.max(0, Math.round(body.clientPlan))
          : prev.clientPlan,
    };
    await this.prisma.opsSettings.upsert({
      where: { id: 'default' },
      create: { id: 'default', businessPlans: plans },
      update: { businessPlans: plans },
    });
    return { month, ...plans[month] };
  }

  async getPlan(month?: string) {
    const today = utcToday();
    const key = month ?? monthKey(today);
    const plans = await this.getPlans();
    return { month: key, ...(plans[key] ?? {}) };
  }

  private async sumFinance(from: Date, to: Date) {
    const agg = await this.prisma.opsFinanceDay.aggregate({
      where: { date: { gte: from, lte: to } },
      _sum: { revenue: true, clientCount: true, net: true, expenses: true },
    });
    return {
      revenue: agg._sum.revenue ?? 0,
      clients: agg._sum.clientCount ?? 0,
      net: agg._sum.net ?? 0,
      expenses: agg._sum.expenses ?? 0,
    };
  }

  private async loadDashboardContext() {
    const today = utcToday();
    const weekStart = startUtcWeekMonday(today);
    const weekEnd = addUtcDays(weekStart, 6);
    const monthStart = startUtcMonth(today);
    const monthEnd = endUtcMonth(today);
    const prevWeekStart = addUtcDays(weekStart, -7);
    const prevWeekEnd = addUtcDays(weekStart, -1);

    const mk = monthKey(today);
    const plans = await this.getPlans();
    const plan = plans[mk] ?? {};

    const [
      dayFin,
      weekFin,
      monthFin,
      prevWeekFin,
      teamDash,
      managerKpi,
      opsDash,
      crmAnalytics,
      loyaltyTotal,
      loyaltyActive,
      problemsOpen,
      intervalsPage,
      crmClientsTotal,
      crmNewMonth,
    ] = await Promise.all([
      this.sumFinance(today, today),
      this.sumFinance(weekStart, weekEnd),
      this.sumFinance(monthStart, monthEnd),
      this.sumFinance(prevWeekStart, prevWeekEnd),
      this.analytics.teamDashboard(today),
      this.analytics.managerKpiSummary(today),
      this.ops.dashboard(today.toISOString().slice(0, 10)),
      this.crm.analytics(),
      this.prisma.loyaltyClient.count(),
      this.prisma.loyaltyClient.count({
        where: { updatedAt: { gte: addUtcDays(today, -30) } },
      }),
      this.prisma.opsProblem.count({ where: { resolved: false } }),
      this.crm.listIntervals(undefined, undefined, 1, 500),
      this.prisma.crmClient.count(),
      this.prisma.crmClient.count({
        where: { createdAt: { gte: monthStart } },
      }),
    ]);

    const intervals = intervalsPage.items;

    const weekRevenueTrend =
      prevWeekFin.revenue > 0
        ? Number(
            (
              ((weekFin.revenue - prevWeekFin.revenue) / prevWeekFin.revenue) *
              100
            ).toFixed(1),
          )
        : 0;

    const repeatDue = intervals.filter(
      (i) => i.urgency === 'overdue' || i.urgency === 'due_soon',
    ).length;
    const overdueIntervals = intervals.filter(
      (i) => i.urgency === 'overdue',
    ).length;
    const bestEmployee = teamDash.best[0];
    const bestName = bestEmployee
      ? ((
          await this.prisma.employee.findUnique({
            where: { id: bestEmployee.employeeId },
            select: { name: true },
          })
        )?.name ?? '—')
      : '—';

    const dash = {
      asOf: today.toISOString().slice(0, 10),
      business: {
        revenueToday: dayFin.revenue,
        revenueWeek: weekFin.revenue,
        revenueMonth: monthFin.revenue,
        revenuePlan: plan.revenuePlan ?? 0,
        clientPlan: plan.clientPlan ?? 0,
        planMonth: mk,
        planCompletionRevenue: pct(monthFin.revenue, plan.revenuePlan ?? 0),
        planCompletionClients: pct(monthFin.clients, plan.clientPlan ?? 0),
        weekRevenueTrend,
        netMonth: monthFin.net,
        expensesMonth: monthFin.expenses,
      },
      clients: {
        crmTotal: crmClientsTotal,
        newThisMonth: crmNewMonth,
        loyaltyTotal,
        loyaltyActive30d: loyaltyActive,
        repeatDue,
        crmRevenueMonth: crmAnalytics.revenue.month,
        noShows: crmAnalytics.noShows,
        arrived: crmAnalytics.arrived,
      },
      employees: {
        teamKpi: teamDash.teamAvgEfficiency,
        weekTrend: teamDash.weekOverWeekTrend,
        bestName,
        bestKpi: bestEmployee?.weeklyEfficiency ?? 0,
        atRiskCount: teamDash.atRiskEmployees.filter(
          (e) => e.weeklyEfficiency > 0 && e.weeklyEfficiency < 60,
        ).length,
        managerKpi: managerKpi.weekly.kpi,
        activeCount: managerKpi.activeEmployees,
      },
      control: {
        totalTasks: opsDash.stats.total,
        done: opsDash.stats.done,
        overdue: opsDash.stats.overdue,
        completionPercent: opsDash.stats.completionPercent,
        problemsOpen,
        needsAttention: opsDash.stats.needsAttention,
      },
      loyalty: {
        totalClients: loyaltyTotal,
        active30d: loyaltyActive,
        index: loyaltyTotal
          ? Math.round((loyaltyActive / loyaltyTotal) * 100)
          : 0,
      },
    };

    return { dash, teamDash, overdueIntervals };
  }

  async unifiedDashboard() {
    const ctx = await this.loadDashboardContext();
    return ctx.dash;
  }

  async aiSummary() {
    const ctx = await this.loadDashboardContext();
    return this.buildAiInsights(ctx);
  }

  async unifiedClients(
    q?: string,
    pageRaw?: string | number,
    limitRaw?: string | number,
  ) {
    const query = q?.trim();
    const { page, limit } = parsePagination(pageRaw, limitRaw, 50, 100);
    const [crmPage, loyaltyRows] = await Promise.all([
      this.crm.listClients(query, undefined, undefined, page, limit),
      this.prisma.loyaltyClient.findMany({
        where: query
          ? {
              OR: [
                { name: { contains: query, mode: 'insensitive' } },
                { phone: { contains: query, mode: 'insensitive' } },
                ...(normalizePhone(query)
                  ? [{ phoneNormalized: { contains: normalizePhone(query) } }]
                  : []),
              ],
            }
          : undefined,
        select: {
          id: true,
          name: true,
          phone: true,
          phoneNormalized: true,
          updatedAt: true,
          _count: { select: { stamps: true } },
          stamps: { where: { slot: 10 }, take: 1, select: { slot: true } },
        },
        take: limit,
        skip: (page - 1) * limit,
        orderBy: { updatedAt: 'desc' },
      }),
    ]);

    const crmRows = crmPage.items as Array<{
      id: string;
      fullName: string;
      phone: string;
      phoneNormalized: string;
      status: string;
      visitsCount: number;
      totalSpent: number;
      recommendedNextAt: string | null;
    }>;

    const loyaltyByPhone = new Map<string, (typeof loyaltyRows)[0]>();
    for (const l of loyaltyRows) {
      if (l.phoneNormalized) loyaltyByPhone.set(l.phoneNormalized, l);
    }

    const merged = crmRows.map((c) => {
      const loyalty = c.phoneNormalized
        ? loyaltyByPhone.get(c.phoneNormalized)
        : undefined;
      if (loyalty) loyaltyByPhone.delete(c.phoneNormalized);
      return {
        id: c.id,
        fullName: c.fullName,
        phone: c.phone,
        crmStatus: c.status,
        visitsCount: c.visitsCount,
        totalSpent: c.totalSpent,
        recommendedNextAt: c.recommendedNextAt,
        loyalty: loyalty
          ? {
              id: loyalty.id,
              stamps: loyalty._count.stamps,
              giftAvailable:
                loyalty._count.stamps >= 9 && loyalty.stamps.length === 0,
            }
          : null,
      };
    });

    const loyaltyOnly = Array.from(loyaltyByPhone.values()).map((l) => ({
      id: `loyalty:${l.id}`,
      fullName: l.name,
      phone: l.phone,
      crmStatus: null,
      visitsCount: l._count.stamps,
      totalSpent: 0,
      recommendedNextAt: null,
      loyalty: {
        id: l.id,
        stamps: l._count.stamps,
        giftAvailable: l._count.stamps >= 9 && l.stamps.length === 0,
      },
    }));

    const items = [...merged, ...loyaltyOnly];
    return paginatedResult(
      items,
      crmPage.total + loyaltyOnly.length,
      page,
      limit,
    );
  }

  private trendPhrase(delta: number, unit: string) {
    if (delta > 0) return `выросла на ${delta}% ${unit}`;
    if (delta < 0) return `снизилась на ${Math.abs(delta)}% ${unit}`;
    return `не изменилась ${unit}`;
  }

  private buildAiInsights(
    ctx: Awaited<ReturnType<InsightsService['loadDashboardContext']>>,
  ) {
    return {
      director: this.buildAiDirector(ctx),
      finance: this.buildAiFinance(ctx),
      hr: this.buildAiHr(ctx),
      marketing: this.buildAiMarketing(ctx),
      operations: this.buildAiOperations(ctx),
    };
  }

  private buildAiDirector(
    ctx: Awaited<ReturnType<InsightsService['loadDashboardContext']>>,
  ) {
    const { dash, overdueIntervals } = ctx;
    const conclusions: string[] = [];
    const recommendations: string[] = [];

    conclusions.push(
      `Выручка за неделю — ${dash.business.revenueWeek.toLocaleString('ru-RU')} ₽; ${this.trendPhrase(dash.business.weekRevenueTrend, 'относительно прошлой недели')}.`,
    );
    if (dash.business.revenuePlan > 0) {
      conclusions.push(
        `План месяца выполнен на ${dash.business.planCompletionRevenue}% по выручке (${dash.business.revenueMonth.toLocaleString('ru-RU')} из ${dash.business.revenuePlan.toLocaleString('ru-RU')} ₽).`,
      );
    }
    conclusions.push(
      `KPI команды за неделю — ${dash.employees.teamKpi.toFixed(1)}% (${dash.employees.weekTrend >= 0 ? '+' : ''}${dash.employees.weekTrend.toFixed(1)} п.п. к прошлой неделе).`,
    );
    if (overdueIntervals > 0) {
      conclusions.push(
        `Повторные записи: ${overdueIntervals} клиентов просрочили рекомендованный интервал.`,
      );
      recommendations.push(
        'Проверьте работу с клиентской базой — CRM → Интервалы / Повторный контакт.',
      );
    }
    if (dash.control.overdue > 0) {
      conclusions.push(
        `В контроле ${dash.control.overdue} просроченных задач.`,
      );
      recommendations.push('Разберите просрочки в разделе «Контроль».');
    }
    if (dash.employees.atRiskCount > 0) {
      conclusions.push(
        `${dash.employees.atRiskCount} сотрудников в зоне риска по KPI.`,
      );
      recommendations.push('Проведите разбор с сотрудниками из зоны внимания.');
    }
    if (!recommendations.length) {
      recommendations.push(
        'Показатели в норме — продолжайте текущий ритм работы.',
      );
    }

    return { role: 'director', conclusions, recommendations };
  }

  private buildAiFinance(
    ctx: Awaited<ReturnType<InsightsService['loadDashboardContext']>>,
  ) {
    const { dash } = ctx;
    const conclusions: string[] = [];
    const recommendations: string[] = [];

    conclusions.push(
      `Выручка сегодня: ${dash.business.revenueToday.toLocaleString('ru-RU')} ₽.`,
    );
    conclusions.push(
      `За месяц: ${dash.business.revenueMonth.toLocaleString('ru-RU')} ₽, чистая выручка: ${dash.business.netMonth.toLocaleString('ru-RU')} ₽.`,
    );
    conclusions.push(
      `Расходы за месяц: ${dash.business.expensesMonth.toLocaleString('ru-RU')} ₽.`,
    );
    conclusions.push(
      this.trendPhrase(dash.business.weekRevenueTrend, 'за неделю'),
    );

    if (
      dash.business.expensesMonth > dash.business.revenueMonth * 0.5 &&
      dash.business.revenueMonth > 0
    ) {
      conclusions.push(
        'Расходы превышают 50% выручки — стоит проверить статьи затрат.',
      );
      recommendations.push('Откройте «Финансы» и сравните расходы по дням.');
    }
    if (
      dash.business.revenuePlan > 0 &&
      dash.business.planCompletionRevenue < 70
    ) {
      const daysLeft =
        new Date(
          utcToday().getUTCFullYear(),
          utcToday().getUTCMonth() + 1,
          0,
        ).getUTCDate() - utcToday().getUTCDate();
      const forecast = Math.round(
        (dash.business.revenueMonth / utcToday().getUTCDate()) *
          (utcToday().getUTCDate() + daysLeft),
      );
      conclusions.push(
        `Прогноз выручки на конец месяца (линейный): ~${forecast.toLocaleString('ru-RU')} ₽.`,
      );
      recommendations.push(
        'Усильте продажи или скорректируйте план, если он нереалистичен.',
      );
    }

    return { role: 'finance', conclusions, recommendations };
  }

  private buildAiHr(
    ctx: Awaited<ReturnType<InsightsService['loadDashboardContext']>>,
  ) {
    const { dash, teamDash } = ctx;
    const conclusions: string[] = [];
    const recommendations: string[] = [];

    conclusions.push(
      `Средний KPI команды: ${dash.employees.teamKpi.toFixed(1)}%.`,
    );
    if (dash.employees.bestName !== '—') {
      conclusions.push(
        `Лучший сотрудник периода: ${dash.employees.bestName} (${dash.employees.bestKpi.toFixed(1)}%).`,
      );
    }
    if (dash.employees.atRiskCount > 0) {
      conclusions.push(
        `В зоне риска: ${dash.employees.atRiskCount} сотрудников (KPI ниже 60%).`,
      );
      recommendations.push(
        'Откройте «Сотрудники» → доска KPI и разберите слабые задачи.',
      );
    }
    if (teamDash.lowPerformingTasks.length > 0) {
      conclusions.push(
        `Слабых задач на неделе: ${teamDash.lowPerformingTasks.length}.`,
      );
    }
    if (!recommendations.length) {
      recommendations.push(
        'Команда работает стабильно — закрепите лучшие практики лидеров.',
      );
    }

    return { role: 'hr', conclusions, recommendations };
  }

  private buildAiMarketing(
    ctx: Awaited<ReturnType<InsightsService['loadDashboardContext']>>,
  ) {
    const { dash } = ctx;
    const conclusions: string[] = [];
    const recommendations: string[] = [];

    conclusions.push(
      `Клиентов в CRM: ${dash.clients.crmTotal}, новых за месяц: ${dash.clients.newThisMonth}.`,
    );
    conclusions.push(
      `Программа лояльности: ${dash.loyalty.totalClients} клиентов, активность 30 дней — ${dash.loyalty.active30d}.`,
    );
    if (dash.clients.repeatDue > 0) {
      conclusions.push(
        `${dash.clients.repeatDue} клиентов требуют повторного контакта по интервалу.`,
      );
      recommendations.push('Обзвоните клиентов из CRM → Повторный контакт.');
    }
    if (dash.clients.noShows > 0) {
      conclusions.push(`Неявок по записям (всего): ${dash.clients.noShows}.`);
      recommendations.push(
        'Уточните причины неявок и напоминания перед визитом.',
      );
    }
    if (!recommendations.length) {
      recommendations.push(
        'Клиентская база в хорошем состоянии — развивайте повторные записи.',
      );
    }

    return { role: 'marketing', conclusions, recommendations };
  }

  private buildAiOperations(
    ctx: Awaited<ReturnType<InsightsService['loadDashboardContext']>>,
  ) {
    const { dash } = ctx;
    const conclusions: string[] = [];
    const recommendations: string[] = [];

    conclusions.push(
      `Задач контроля: ${dash.control.totalTasks}, выполнено ${dash.control.done} (${dash.control.completionPercent}%).`,
    );
    if (dash.control.overdue > 0) {
      conclusions.push(`Просрочено: ${dash.control.overdue} задач.`);
      recommendations.push('Начните с просроченных задач в «Контроле».');
    }
    if (dash.control.problemsOpen > 0) {
      conclusions.push(`Открытых проблем: ${dash.control.problemsOpen}.`);
      recommendations.push(
        'Закройте или назначьте ответственных в «Проблемы».',
      );
    }
    if (dash.control.needsAttention > 0) {
      conclusions.push(
        `Требуют внимания: ${dash.control.needsAttention} задач.`,
      );
    }
    if (!recommendations.length) {
      recommendations.push('Операционные процессы под контролем.');
    }

    return { role: 'operations', conclusions, recommendations };
  }

  async aiDirector() {
    const ctx = await this.loadDashboardContext();
    return this.buildAiDirector(ctx);
  }

  async aiFinance() {
    const ctx = await this.loadDashboardContext();
    return this.buildAiFinance(ctx);
  }

  async aiHr() {
    const ctx = await this.loadDashboardContext();
    return this.buildAiHr(ctx);
  }

  async aiMarketing() {
    const ctx = await this.loadDashboardContext();
    return this.buildAiMarketing(ctx);
  }

  async aiOperations() {
    const ctx = await this.loadDashboardContext();
    return this.buildAiOperations(ctx);
  }

  async batchEmployeeOverviews(ids: string[]) {
    const unique = [...new Set(ids.filter(Boolean))];
    if (!unique.length) return {};
    const to = new Date();
    const from = addUtcDays(to, -56);
    return this.analytics.batchEmployeeRangeAnalytics(unique, from, to);
  }
}
