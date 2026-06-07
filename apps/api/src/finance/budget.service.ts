import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import type { User } from "@prisma/client";
import {
  BudgetCreatedFrom,
  BudgetStatus,
  FinanceCategoryType,
  Prisma
} from "@prisma/client";

type BudgetLineStatus = "ok" | "warning" | "exceeded";
import { FarmAccessService } from "../common/farm-access.service";
import { PrismaService } from "../prisma/prisma.service";
import { AiGeminiService } from "../ai/ai-gemini.service";
import { ensureFarmFinanceBootstrap } from "./finance-bootstrap";

type MonthRef = { year: number; month: number };

function monthRange(ref: MonthRef): { start: Date; end: Date } {
  const start = new Date(Date.UTC(ref.year, ref.month - 1, 1));
  const end = new Date(Date.UTC(ref.year, ref.month, 1));
  return { start, end };
}

function prevMonth(ref: MonthRef): MonthRef {
  if (ref.month === 1) {
    return { year: ref.year - 1, month: 12 };
  }
  return { year: ref.year, month: ref.month - 1 };
}

function nextMonth(ref: MonthRef): MonthRef {
  if (ref.month === 12) {
    return { year: ref.year + 1, month: 1 };
  }
  return { year: ref.year, month: ref.month + 1 };
}

function daysInMonth(ref: MonthRef): number {
  return new Date(Date.UTC(ref.year, ref.month, 0)).getUTCDate();
}

function statusFromPct(pct: number): BudgetLineStatus {
  if (pct > 100) {
    return "exceeded";
  }
  if (pct >= 80) {
    return "warning";
  }
  return "ok";
}

function globalStatusFromPct(pct: number): BudgetStatus {
  if (pct > 100) {
    return BudgetStatus.exceeded;
  }
  if (pct >= 80) {
    return BudgetStatus.warning;
  }
  return BudgetStatus.on_track;
}

@Injectable()
export class BudgetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly farmAccess: FarmAccessService,
    private readonly gemini: AiGeminiService
  ) {}

  private async expenseCategories(farmId: string) {
    return this.prisma.financeCategory.findMany({
      where: { farmId, type: FinanceCategoryType.expense },
      orderBy: { name: "asc" }
    });
  }

  private async totalMonthExpenses(
    farmId: string,
    ref: MonthRef
  ): Promise<Prisma.Decimal> {
    const { start, end } = monthRange(ref);
    const agg = await this.prisma.farmExpense.aggregate({
      where: { farmId, occurredAt: { gte: start, lt: end } },
      _sum: { amount: true }
    });
    return agg._sum.amount ?? new Prisma.Decimal(0);
  }

  private async realizedByCategory(
    farmId: string,
    ref: MonthRef
  ): Promise<Map<string, Prisma.Decimal>> {
    const { start, end } = monthRange(ref);
    const rows = await this.prisma.farmExpense.findMany({
      where: { farmId, occurredAt: { gte: start, lt: end } },
      select: { financeCategoryId: true, amount: true }
    });
    const map = new Map<string, Prisma.Decimal>();
    for (const r of rows) {
      const key = r.financeCategoryId ?? "uncategorized";
      const cur = map.get(key) ?? new Prisma.Decimal(0);
      map.set(key, cur.add(r.amount));
    }
    return map;
  }

  private projectAmount(
    realized: Prisma.Decimal,
    ref: MonthRef,
    now: Date
  ): Prisma.Decimal {
    const dim = daysInMonth(ref);
    const isCurrent =
      now.getUTCFullYear() === ref.year && now.getUTCMonth() + 1 === ref.month;
    const day = isCurrent ? Math.max(1, now.getUTCDate()) : dim;
    const r = Number(realized.toString());
    if (r <= 0) {
      return new Prisma.Decimal(0);
    }
    const projected = (r / day) * dim;
    return new Prisma.Decimal(projected);
  }

  private buildLineDto(
    category: {
      id: string;
      key: string;
      name: string;
      icon: string | null;
    },
    amountPlanned: Prisma.Decimal,
    realized: Prisma.Decimal,
    ref: MonthRef,
    now: Date,
    currency: string
  ) {
    const planned = Number(amountPlanned.toString());
    const real = Number(realized.toString());
    const projected = this.projectAmount(realized, ref, now);
    const projN = Number(projected.toString());
    const pct = planned > 0 ? (real / planned) * 100 : real > 0 ? 100 : 0;
    const remaining = planned - real;
    const projPct = planned > 0 ? (projN / planned) * 100 : 0;
    return {
      categoryId: category.id,
      categoryKey: category.key,
      categoryName: category.name,
      categoryIcon: category.icon,
      amountPlanned: amountPlanned.toString(),
      amountRealized: realized.toString(),
      amountProjected: projected.toString(),
      consumptionPct: Math.round(pct * 10) / 10,
      projectedConsumptionPct: Math.round(projPct * 10) / 10,
      remaining: remaining.toString(),
      status: statusFromPct(pct),
      projectedStatus: statusFromPct(projPct),
      currency
    };
  }

  private async composeBudgetView(
    farmId: string,
    ref: MonthRef,
    budget: {
      id: string;
      totalPlanned: Prisma.Decimal;
      status: BudgetStatus;
      createdFrom: BudgetCreatedFrom;
      lines: { id: string; categoryId: string; amountPlanned: Prisma.Decimal }[];
    } | null
  ) {
    const settings = await this.prisma.farmFinanceSettings.findUniqueOrThrow({
      where: { farmId }
    });
    const categories = await this.expenseCategories(farmId);
    const realizedMap = await this.realizedByCategory(farmId, ref);
    const now = new Date();
    const plannedByCat = new Map<string, Prisma.Decimal>();
    if (budget) {
      for (const l of budget.lines) {
        plannedByCat.set(l.categoryId, l.amountPlanned);
      }
    }

    const lineIdByCat = new Map<string, string>();
    if (budget) {
      for (const l of budget.lines) {
        lineIdByCat.set(l.categoryId, l.id);
      }
    }

    const lines = categories.map((c) => {
      const planned =
        plannedByCat.get(c.id) ?? new Prisma.Decimal(0);
      const realized =
        realizedMap.get(c.id) ?? new Prisma.Decimal(0);
      return {
        budgetLineId: lineIdByCat.get(c.id) ?? null,
        ...this.buildLineDto(c, planned, realized, ref, now, settings.currencyCode)
      };
    });

    const uncategorizedRealized =
      realizedMap.get("uncategorized") ?? new Prisma.Decimal(0);
    if (uncategorizedRealized.gt(0)) {
      lines.push({
        budgetLineId: null,
        categoryId: "__uncategorized__",
        categoryKey: "uncategorized",
        categoryName: "Sans categorie",
        categoryIcon: "📋",
        amountPlanned: "0",
        amountRealized: uncategorizedRealized.toString(),
        amountProjected: this.projectAmount(
          uncategorizedRealized,
          ref,
          now
        ).toString(),
        consumptionPct: 100,
        projectedConsumptionPct: 100,
        remaining: uncategorizedRealized.neg().toString(),
        status: "exceeded" as BudgetLineStatus,
        projectedStatus: "exceeded" as BudgetLineStatus,
        currency: settings.currencyCode
      });
    }

    const totalPlanned = budget
      ? budget.totalPlanned
      : lines.reduce(
          (s, l) =>
            l.categoryKey === "uncategorized"
              ? s
              : s.add(new Prisma.Decimal(l.amountPlanned)),
          new Prisma.Decimal(0)
        );
    const totalRealized = await this.totalMonthExpenses(farmId, ref);
    const totalProjected = this.projectAmount(totalRealized, ref, now);

    const totalPlannedN = Number(totalPlanned.toString());
    const totalRealizedN = Number(totalRealized.toString());
    const totalProjectedN = Number(totalProjected.toString());
    const globalPct =
      totalPlannedN > 0 ? (totalRealizedN / totalPlannedN) * 100 : 0;
    const globalStatus = budget
      ? budget.status
      : globalStatusFromPct(globalPct);
    const remaining = totalPlannedN - totalRealizedN;
    const deltaProjected = totalProjectedN - totalPlannedN;

    const suggestions = budget
      ? await this.prisma.farmBudgetSuggestion.findMany({
          where: {
            farmId,
            budgetId: budget.id,
            isDismissed: false,
            isApplied: false
          },
          orderBy: { createdAt: "desc" }
        })
      : [];

    return {
      farmId,
      year: ref.year,
      month: ref.month,
      configured: Boolean(budget),
      budgetId: budget?.id ?? null,
      currency: settings.currencyCode,
      currencySymbol: settings.currencySymbol,
      createdFrom: budget?.createdFrom ?? null,
      global: {
        totalPlanned: totalPlanned.toString(),
        totalRealized: totalRealized.toString(),
        totalProjected: totalProjected.toString(),
        remaining: remaining.toString(),
        consumptionPct: Math.round(globalPct * 10) / 10,
        status: globalStatus,
        deltaProjected: deltaProjected.toString(),
        projectedEndOfMonth: totalProjected.toString()
      },
      lines,
      suggestions: suggestions.map((s) => ({
        id: s.id,
        type: s.type,
        message: s.message,
        actionPayload: s.actionPayload,
        isApplied: s.isApplied,
        isDismissed: s.isDismissed,
        createdAt: s.createdAt.toISOString()
      }))
    };
  }

  async getBudget(user: User, farmId: string, year: number, month: number) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    await ensureFarmFinanceBootstrap(this.prisma, farmId);

    const budget = await this.prisma.farmBudget.findUnique({
      where: { farmId_year_month: { farmId, year, month } },
      include: { lines: true }
    });

    if (budget) {
      await this.regenerateSuggestions(user, farmId, budget.id, { year, month });
      const refreshed = await this.prisma.farmBudget.findUnique({
        where: { id: budget.id },
        include: { lines: true }
      });
      return this.composeBudgetView(farmId, { year, month }, refreshed);
    }
    return this.composeBudgetView(farmId, { year, month }, null);
  }

  async upsertBudget(
    user: User,
    farmId: string,
    body: {
      year: number;
      month: number;
      lines: { categoryId: string; amountPlanned: number }[];
      createdFrom?: BudgetCreatedFrom;
    }
  ) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    await ensureFarmFinanceBootstrap(this.prisma, farmId);

    const categories = await this.expenseCategories(farmId);
    const catIds = new Set(categories.map((c) => c.id));
    for (const l of body.lines) {
      if (!catIds.has(l.categoryId)) {
        throw new BadRequestException("Categorie invalide");
      }
    }

    let total = new Prisma.Decimal(0);
    for (const l of body.lines) {
      total = total.add(new Prisma.Decimal(l.amountPlanned));
    }

    const totalRealized = await this.totalMonthExpenses(farmId, {
      year: body.year,
      month: body.month
    });
    const pct =
      Number(total.toString()) > 0
        ? (Number(totalRealized.toString()) / Number(total.toString())) * 100
        : 0;

    const budget = await this.prisma.farmBudget.upsert({
      where: {
        farmId_year_month: {
          farmId,
          year: body.year,
          month: body.month
        }
      },
      create: {
        farmId,
        year: body.year,
        month: body.month,
        totalPlanned: total,
        status: globalStatusFromPct(pct),
        createdFrom: body.createdFrom ?? BudgetCreatedFrom.manual,
        lines: {
          create: body.lines.map((l) => ({
            categoryId: l.categoryId,
            amountPlanned: new Prisma.Decimal(l.amountPlanned)
          }))
        }
      },
      update: {
        totalPlanned: total,
        status: globalStatusFromPct(pct),
        createdFrom: body.createdFrom ?? BudgetCreatedFrom.manual,
        lines: {
          deleteMany: {},
          create: body.lines.map((l) => ({
            categoryId: l.categoryId,
            amountPlanned: new Prisma.Decimal(l.amountPlanned)
          }))
        }
      },
      include: { lines: true }
    });

    await this.regenerateSuggestions(user, farmId, budget.id, {
      year: body.year,
      month: body.month
    });

    return this.composeBudgetView(
      farmId,
      { year: body.year, month: body.month },
      budget
    );
  }

  async copyPreviousMonth(
    user: User,
    farmId: string,
    year: number,
    month: number
  ) {
    const prev = prevMonth({ year, month });
    const prevBudget = await this.prisma.farmBudget.findUnique({
      where: {
        farmId_year_month: { farmId, year: prev.year, month: prev.month }
      },
      include: { lines: true }
    });
    if (!prevBudget) {
      throw new NotFoundException("Aucun budget pour le mois precedent");
    }
    return this.upsertBudget(user, farmId, {
      year,
      month,
      createdFrom: BudgetCreatedFrom.copied,
      lines: prevBudget.lines.map((l) => ({
        categoryId: l.categoryId,
        amountPlanned: Number(l.amountPlanned.toString())
      }))
    });
  }

  async suggestionAuto(
    user: User,
    farmId: string,
    year: number,
    month: number
  ) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    const categories = await this.expenseCategories(farmId);
    const lines: { categoryId: string; amountPlanned: number }[] = [];

    for (const cat of categories) {
      let sum = new Prisma.Decimal(0);
      let count = 0;
      let ref: MonthRef = { year, month };
      for (let i = 0; i < 3; i += 1) {
        ref = prevMonth(ref);
        const { start, end } = monthRange(ref);
        const agg = await this.prisma.farmExpense.aggregate({
          where: {
            farmId,
            financeCategoryId: cat.id,
            occurredAt: { gte: start, lt: end }
          },
          _sum: { amount: true }
        });
        const v = agg._sum.amount ?? new Prisma.Decimal(0);
        sum = sum.add(v);
        count += 1;
      }
      const avg = count > 0 ? sum.div(count) : new Prisma.Decimal(0);
      lines.push({
        categoryId: cat.id,
        amountPlanned: Number(avg.toString())
      });
    }

    return this.upsertBudget(user, farmId, {
      year,
      month,
      lines,
      createdFrom: BudgetCreatedFrom.auto_suggested
    });
  }

  async updateBudgetLine(
    user: User,
    farmId: string,
    lineId: string,
    amountPlanned: number
  ) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    const line = await this.prisma.farmBudgetLine.findFirst({
      where: { id: lineId, budget: { farmId } },
      include: { budget: { include: { lines: true } } }
    });
    if (!line) {
      throw new NotFoundException("Ligne budget introuvable");
    }

    await this.prisma.farmBudgetLine.update({
      where: { id: lineId },
      data: { amountPlanned: new Prisma.Decimal(amountPlanned) }
    });

    const total = line.budget.lines.reduce((s, l) => {
      const amt =
        l.id === lineId
          ? new Prisma.Decimal(amountPlanned)
          : l.amountPlanned;
      return s.add(amt);
    }, new Prisma.Decimal(0));

    const totalRealized = await this.totalMonthExpenses(farmId, {
      year: line.budget.year,
      month: line.budget.month
    });
    const pct =
      Number(total.toString()) > 0
        ? (Number(totalRealized.toString()) / Number(total.toString())) * 100
        : 0;

    const budget = await this.prisma.farmBudget.update({
      where: { id: line.budgetId },
      data: {
        totalPlanned: total,
        status: globalStatusFromPct(pct)
      },
      include: { lines: true }
    });

    return this.composeBudgetView(
      farmId,
      { year: budget.year, month: budget.month },
      budget
    );
  }

  async getCategoryHistory(
    user: User,
    farmId: string,
    categoryId: string,
    year: number,
    month: number
  ) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    const points: { year: number; month: number; expenses: string }[] = [];
    let ref: MonthRef = { year, month };
    for (let i = 0; i < 3; i += 1) {
      ref = prevMonth(ref);
      const { start, end } = monthRange(ref);
      const agg = await this.prisma.farmExpense.aggregate({
        where: {
          farmId,
          financeCategoryId: categoryId,
          occurredAt: { gte: start, lt: end }
        },
        _sum: { amount: true }
      });
      points.push({
        year: ref.year,
        month: ref.month,
        expenses: (agg._sum.amount ?? new Prisma.Decimal(0)).toString()
      });
    }
    const avg =
      points.length > 0
        ? points
            .reduce(
              (s, p) => s.add(new Prisma.Decimal(p.expenses)),
              new Prisma.Decimal(0)
            )
            .div(points.length)
        : new Prisma.Decimal(0);
    return {
      categoryId,
      points: points.reverse(),
      averageExpenses: avg.toString()
    };
  }

  async simulate(
    user: User,
    farmId: string,
    year: number,
    month: number,
    categoryId: string,
    newAmount: number
  ) {
    const view = await this.getBudget(user, farmId, year, month);
    const lines = view.lines.map((l) =>
      l.categoryId === categoryId
        ? { ...l, amountPlanned: String(newAmount) }
        : l
    );
    const totalPlanned = lines.reduce(
      (s, l) => s + Number(l.amountPlanned),
      0
    );
    const totalRealized = Number(view.global.totalRealized);
    const totalProjected = lines.reduce(
      (s, l) => s + Number(l.amountProjected),
      0
    );
    const globalPct =
      totalPlanned > 0 ? (totalRealized / totalPlanned) * 100 : 0;
    return {
      categoryId,
      newAmount: String(newAmount),
      global: {
        totalPlanned: String(totalPlanned),
        totalRealized: view.global.totalRealized,
        totalProjected: String(totalProjected),
        remaining: String(totalPlanned - totalRealized),
        consumptionPct: Math.round(globalPct * 10) / 10,
        status: globalStatusFromPct(globalPct),
        previousTotalPlanned: view.global.totalPlanned,
        marginAvailable: String(totalPlanned - totalRealized)
      },
      lines
    };
  }

  async patchSuggestion(
    user: User,
    farmId: string,
    suggestionId: string,
    opts: { apply?: boolean; dismiss?: boolean }
  ) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    const row = await this.prisma.farmBudgetSuggestion.findFirst({
      where: { id: suggestionId, farmId }
    });
    if (!row) {
      throw new NotFoundException("Suggestion introuvable");
    }

    if (opts.dismiss) {
      await this.prisma.farmBudgetSuggestion.update({
        where: { id: suggestionId },
        data: { isDismissed: true }
      });
    } else if (opts.apply && row.actionPayload) {
      const payload = row.actionPayload as Record<string, unknown>;
      const action = payload.action as string | undefined;
      if (action === "set_line_amount" && row.budgetId) {
        const categoryId = payload.categoryId as string;
        const amount = Number(payload.amountPlanned);
        const line = await this.prisma.farmBudgetLine.findFirst({
          where: { budgetId: row.budgetId, categoryId }
        });
        if (line) {
          await this.updateBudgetLine(user, farmId, line.id, amount);
        }
      } else if (action === "copy_previous" && payload.year && payload.month) {
        await this.copyPreviousMonth(
          user,
          farmId,
          Number(payload.year),
          Number(payload.month)
        );
      }
      await this.prisma.farmBudgetSuggestion.update({
        where: { id: suggestionId },
        data: { isApplied: true }
      });
    }

    if (row.budgetId) {
      const b = await this.prisma.farmBudget.findUnique({
        where: { id: row.budgetId }
      });
      if (b) {
        return this.getBudget(user, farmId, b.year, b.month);
      }
    }
    return this.getBudget(
      user,
      farmId,
      new Date().getUTCFullYear(),
      new Date().getUTCMonth() + 1
    );
  }

  private async regenerateSuggestions(
    _user: User,
    farmId: string,
    budgetId: string,
    ref: MonthRef
  ) {
    await this.prisma.farmBudgetSuggestion.deleteMany({
      where: { budgetId, isApplied: false, isDismissed: false }
    });

    const budget = await this.prisma.farmBudget.findUnique({
      where: { id: budgetId },
      include: { lines: true }
    });
    if (!budget) {
      return;
    }

    const view = await this.composeBudgetView(farmId, ref, budget);
    const settings = await this.prisma.farmFinanceSettings.findUniqueOrThrow({
      where: { farmId }
    });
    const sym = settings.currencySymbol;

    const toCreate: {
      type: string;
      message: string;
      actionPayload: object;
    }[] = [];

    for (const line of view.lines) {
      if (line.status === "exceeded") {
        const prev = prevMonth(ref);
        const prevBudget = await this.prisma.farmBudget.findUnique({
          where: {
            farmId_year_month: {
              farmId,
              year: prev.year,
              month: prev.month
            }
          },
          include: { lines: true }
        });
        const prevLine = prevBudget?.lines.find(
          (l) => l.categoryId === line.categoryId
        );
        if (prevLine) {
          const prevRealized = await this.realizedByCategory(farmId, prev);
          const prevAmt = Number(
            (prevRealized.get(line.categoryId) ?? new Prisma.Decimal(0)).toString()
          );
          const prevPlanned = Number(prevLine.amountPlanned.toString());
          if (prevPlanned > 0 && prevAmt / prevPlanned > 1) {
            const suggested = Math.ceil(prevAmt * 1.05);
            toCreate.push({
              type: "category_exceeded_twice",
              message: `Budget ${line.categoryName} depasse 2 mois de suite — augmenter a ${suggested} ${sym} ?`,
              actionPayload: {
                action: "set_line_amount",
                categoryId: line.categoryId,
                amountPlanned: suggested
              }
            });
          }
        }
      }

      if (
        line.consumptionPct < 50 &&
        Number(line.amountPlanned) > 0
      ) {
        const prev = prevMonth(ref);
        const prevRealized = await this.realizedByCategory(farmId, prev);
        const prevAmt = Number(
          (prevRealized.get(line.categoryId) ?? new Prisma.Decimal(0)).toString()
        );
        const prevPlanned = Number(line.amountPlanned);
        if (prevPlanned > 0 && prevAmt / prevPlanned < 0.5) {
          const freed = Math.round(Number(line.amountPlanned) * 0.2);
          toCreate.push({
            type: "category_underused",
            message: `Budget ${line.categoryName} sous-utilise — liberer environ ${freed} ${sym} ?`,
            actionPayload: {
              action: "set_line_amount",
              categoryId: line.categoryId,
              amountPlanned: Math.max(
                0,
                Number(line.amountPlanned) - freed
              )
            }
          });
        }
      }

      if (
        line.projectedStatus === "exceeded" &&
        Number(line.amountPlanned) > 0
      ) {
        const over = Number(line.amountProjected) - Number(line.amountPlanned);
        if (over > 0) {
          toCreate.push({
            type: "projection_overrun",
            message: `${line.categoryName} : depassement prevu de ${Math.round(over)} ${sym} — ajuster maintenant ?`,
            actionPayload: {
              action: "set_line_amount",
              categoryId: line.categoryId,
              amountPlanned: Math.ceil(Number(line.amountProjected))
            }
          });
        }
      }
    }

    const next = nextMonth(ref);
    const nextBudget = await this.prisma.farmBudget.findUnique({
      where: {
        farmId_year_month: {
          farmId,
          year: next.year,
          month: next.month
        }
      }
    });
    if (!nextBudget) {
      toCreate.push({
        type: "next_month_missing",
        message: `Budget ${next.month}/${next.year} non defini — copier ${ref.month}/${ref.year} ?`,
        actionPayload: {
          action: "copy_previous",
          year: next.year,
          month: next.month
        }
      });
    }

    for (const s of toCreate.slice(0, 8)) {
      await this.prisma.farmBudgetSuggestion.create({
        data: {
          farmId,
          budgetId,
          type: s.type,
          message: s.message,
          actionPayload: s.actionPayload
        }
      });
    }
  }

  async analyzeBudgetWithAi(
    user: User,
    farmId: string,
    year: number,
    month: number
  ) {
    const view = await this.getBudget(user, farmId, year, month);
    const prev = prevMonth({ year, month });
    const prevView = await this.getBudget(user, farmId, prev.year, prev.month);

    const expenseLines = view.lines.filter(
      (l) => Number(l.amountPlanned) >= 0 && l.categoryKey !== "uncategorized"
    );
    const historyByCategory = expenseLines.map((l) => ({
      categoryId: l.categoryId,
      categoryName: l.categoryName,
      currentBudget: Number(l.amountPlanned),
      realized: Number(l.amountRealized),
      projected: Number(l.amountProjected),
      prevBudget: Number(
        prevView.lines.find((p) => p.categoryId === l.categoryId)
          ?.amountPlanned ?? 0
      )
    }));

    const herd = await this.prisma.animal.count({
      where: { farmId, status: "active" }
    });

    const fallback = {
      analysis:
        "Analyse basée sur vos budgets et dépenses du mois. Ajustez les postes où la consommation dépasse 80 % du budget prévu.",
      recommendations: expenseLines
        .filter((l) => {
          const pct =
            Number(l.amountPlanned) > 0
              ? (Number(l.amountRealized) / Number(l.amountPlanned)) * 100
              : 0;
          return pct >= 85;
        })
        .slice(0, 5)
        .map((l) => {
          const current = Number(l.amountPlanned);
          const suggested = Math.round(current * 0.9);
          return {
            categoryId: l.categoryId,
            categoryName: l.categoryName,
            currentBudget: current,
            suggestedBudget: suggested,
            savings: current - suggested,
            action: `Réduire le budget « ${l.categoryName} » de 10 %`,
            justification: "Consommation proche ou au-dessus du budget actuel."
          };
        }),
      totalSavingsEstimate: 0,
      aiPowered: false
    };
    fallback.totalSavingsEstimate = fallback.recommendations.reduce(
      (s, r) => s + r.savings,
      0
    );

    if (!this.gemini.isConfigured()) {
      return fallback;
    }

    const prompt = `Tu es un conseiller financier expert en élevage porcin. Analyse ces données et réponds UNIQUEMENT en JSON valide :
{
  "analysis": "string (3-4 phrases en français)",
  "recommendations": [{
    "categoryId": "string",
    "categoryName": "string",
    "currentBudget": number,
    "suggestedBudget": number,
    "savings": number,
    "action": "string",
    "justification": "string"
  }],
  "totalSavingsEstimate": number
}
Données budget mois ${month}/${year} : ${JSON.stringify(historyByCategory)}
Effectif cheptel actif : ${herd}`;

    const raw = await this.gemini.generateText(prompt);
    if (!raw) {
      return fallback;
    }
    try {
      const parsed = JSON.parse(raw) as typeof fallback;
      return {
        ...parsed,
        aiPowered: true,
        recommendations: (parsed.recommendations ?? []).map((r, i) => ({
          ...r,
          categoryId:
            r.categoryId ||
            historyByCategory[i]?.categoryId ||
            expenseLines[i]?.categoryId ||
            ""
        }))
      };
    } catch {
      return fallback;
    }
  }

  async applyAiBudgetRecommendations(
    user: User,
    farmId: string,
    year: number,
    month: number,
    items: Array<{ categoryId: string; suggestedBudget: number }>
  ) {
    const view = await this.getBudget(user, farmId, year, month);
    if (!view.budgetId) {
      throw new BadRequestException("Budget non configuré pour ce mois");
    }
    for (const item of items) {
      const line = view.lines.find((l) => l.categoryId === item.categoryId);
      if (!line?.budgetLineId) {
        continue;
      }
      await this.updateBudgetLine(
        user,
        farmId,
        line.budgetLineId,
        item.suggestedBudget
      );
    }
    return this.getBudget(user, farmId, year, month);
  }
}
