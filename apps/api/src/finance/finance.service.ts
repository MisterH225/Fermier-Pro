import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import type { FarmExpense, FarmRevenue, User } from "@prisma/client";
import { FinanceCategoryType, Prisma } from "@prisma/client";
import PDFDocument from "pdfkit";
import { AUDIT_ACTION } from "../common/audit.constants";
import { AuditService } from "../common/audit.service";
import { FarmAccessService } from "../common/farm-access.service";
import { PrismaService } from "../prisma/prisma.service";
import { ensureFarmFinanceBootstrap } from "./finance-bootstrap";
import { CreateExpenseDto } from "./dto/create-expense.dto";
import { CreateRevenueDto } from "./dto/create-revenue.dto";
import { UpdateExpenseDto } from "./dto/update-expense.dto";
import { UpdateRevenueDto } from "./dto/update-revenue.dto";

@Injectable()
export class FinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly farmAccess: FarmAccessService,
    private readonly audit: AuditService
  ) {}

  private expenseSnapshot(row: FarmExpense) {
    return {
      amount: row.amount.toString(),
      currency: row.currency,
      label: row.label,
      category: row.category ?? undefined,
      occurredAt: row.occurredAt.toISOString()
    };
  }

  private revenueSnapshot(row: FarmRevenue) {
    return {
      amount: row.amount.toString(),
      currency: row.currency,
      label: row.label,
      category: row.category ?? undefined,
      occurredAt: row.occurredAt.toISOString()
    };
  }

  private async getExpenseOnFarm(farmId: string, expenseId: string) {
    const row = await this.prisma.farmExpense.findFirst({
      where: { id: expenseId, farmId }
    });
    if (!row) {
      throw new NotFoundException("Depense introuvable");
    }
    return row;
  }

  private async getRevenueOnFarm(farmId: string, revenueId: string) {
    const row = await this.prisma.farmRevenue.findFirst({
      where: { id: revenueId, farmId }
    });
    if (!row) {
      throw new NotFoundException("Revenu introuvable");
    }
    return row;
  }

  async getExpense(user: User, farmId: string, expenseId: string) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    const row = await this.prisma.farmExpense.findFirst({
      where: { id: expenseId, farmId },
      include: {
        creator: { select: { id: true, fullName: true, email: true } }
      }
    });
    if (!row) {
      throw new NotFoundException("Depense introuvable");
    }
    return row;
  }

  async listExpenses(
    user: User,
    farmId: string,
    from?: string,
    to?: string
  ) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    const where: Prisma.FarmExpenseWhereInput = { farmId };
    if (from || to) {
      where.occurredAt = {};
      if (from) {
        where.occurredAt.gte = new Date(from);
      }
      if (to) {
        where.occurredAt.lte = new Date(to);
      }
    }
    return this.prisma.farmExpense.findMany({
      where,
      orderBy: { occurredAt: "desc" },
      include: {
        creator: { select: { id: true, fullName: true, email: true } }
      }
    });
  }

  async createExpense(user: User, farmId: string, dto: CreateExpenseDto) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    await ensureFarmFinanceBootstrap(this.prisma, farmId);
    const finSettings = await this.prisma.farmFinanceSettings.findUniqueOrThrow({
      where: { farmId }
    });
    if (dto.financeCategoryId) {
      await this.assertFinanceCategory(
        farmId,
        dto.financeCategoryId,
        FinanceCategoryType.expense
      );
    }
    const row = await this.prisma.farmExpense.create({
      data: {
        farmId,
        amount: new Prisma.Decimal(dto.amount),
        currency: dto.currency ?? finSettings.currencyCode,
        label: dto.label,
        category: dto.category,
        note: dto.note,
        occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : new Date(),
        createdByUserId: user.id,
        financeCategoryId: dto.financeCategoryId,
        linkedEntityType: dto.linkedEntityType,
        linkedEntityId: dto.linkedEntityId,
        attachmentUrl: dto.attachmentUrl
      }
    });
    await this.audit.record({
      actorUserId: user.id,
      farmId,
      action: AUDIT_ACTION.financeExpenseCreated,
      resourceType: "FarmExpense",
      resourceId: row.id,
      metadata: {
        amount: row.amount.toString(),
        currency: row.currency,
        label: row.label
      }
    });
    return row;
  }

  async updateExpense(
    user: User,
    farmId: string,
    expenseId: string,
    dto: UpdateExpenseDto
  ) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    const before = await this.getExpenseOnFarm(farmId, expenseId);
    if (
      dto.amount === undefined &&
      dto.currency === undefined &&
      dto.label === undefined &&
      dto.category === undefined &&
      dto.note === undefined &&
      dto.occurredAt === undefined
    ) {
      throw new BadRequestException("Rien a mettre a jour");
    }
    const row = await this.prisma.farmExpense.update({
      where: { id: expenseId },
      data: {
        ...(dto.amount !== undefined
          ? { amount: new Prisma.Decimal(dto.amount) }
          : {}),
        ...(dto.currency !== undefined ? { currency: dto.currency } : {}),
        ...(dto.label !== undefined ? { label: dto.label } : {}),
        ...(dto.category !== undefined ? { category: dto.category } : {}),
        ...(dto.note !== undefined ? { note: dto.note } : {}),
        ...(dto.occurredAt !== undefined
          ? { occurredAt: new Date(dto.occurredAt) }
          : {})
      },
      include: {
        creator: { select: { id: true, fullName: true, email: true } }
      }
    });
    await this.audit.record({
      actorUserId: user.id,
      farmId,
      action: AUDIT_ACTION.financeExpenseUpdated,
      resourceType: "FarmExpense",
      resourceId: expenseId,
      metadata: {
        before: this.expenseSnapshot(before),
        after: this.expenseSnapshot(row)
      }
    });
    return row;
  }

  async deleteExpense(user: User, farmId: string, expenseId: string) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    const before = await this.getExpenseOnFarm(farmId, expenseId);
    await this.prisma.farmExpense.delete({ where: { id: expenseId } });
    await this.audit.record({
      actorUserId: user.id,
      farmId,
      action: AUDIT_ACTION.financeExpenseDeleted,
      resourceType: "FarmExpense",
      resourceId: expenseId,
      metadata: this.expenseSnapshot(before)
    });
    return { ok: true };
  }

  async getRevenue(user: User, farmId: string, revenueId: string) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    const row = await this.prisma.farmRevenue.findFirst({
      where: { id: revenueId, farmId },
      include: {
        creator: { select: { id: true, fullName: true, email: true } }
      }
    });
    if (!row) {
      throw new NotFoundException("Revenu introuvable");
    }
    return row;
  }

  async listRevenues(
    user: User,
    farmId: string,
    from?: string,
    to?: string
  ) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    const where: Prisma.FarmRevenueWhereInput = { farmId };
    if (from || to) {
      where.occurredAt = {};
      if (from) {
        where.occurredAt.gte = new Date(from);
      }
      if (to) {
        where.occurredAt.lte = new Date(to);
      }
    }
    return this.prisma.farmRevenue.findMany({
      where,
      orderBy: { occurredAt: "desc" },
      include: {
        creator: { select: { id: true, fullName: true, email: true } }
      }
    });
  }

  async createRevenue(user: User, farmId: string, dto: CreateRevenueDto) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    await ensureFarmFinanceBootstrap(this.prisma, farmId);
    const finSettings = await this.prisma.farmFinanceSettings.findUniqueOrThrow({
      where: { farmId }
    });
    if (dto.financeCategoryId) {
      await this.assertFinanceCategory(
        farmId,
        dto.financeCategoryId,
        FinanceCategoryType.income
      );
    }
    const row = await this.prisma.farmRevenue.create({
      data: {
        farmId,
        amount: new Prisma.Decimal(dto.amount),
        currency: dto.currency ?? finSettings.currencyCode,
        label: dto.label,
        category: dto.category,
        note: dto.note,
        occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : new Date(),
        createdByUserId: user.id,
        financeCategoryId: dto.financeCategoryId,
        linkedEntityType: dto.linkedEntityType,
        linkedEntityId: dto.linkedEntityId,
        attachmentUrl: dto.attachmentUrl
      }
    });
    await this.audit.record({
      actorUserId: user.id,
      farmId,
      action: AUDIT_ACTION.financeRevenueCreated,
      resourceType: "FarmRevenue",
      resourceId: row.id,
      metadata: {
        amount: row.amount.toString(),
        currency: row.currency,
        label: row.label
      }
    });
    return row;
  }

  async updateRevenue(
    user: User,
    farmId: string,
    revenueId: string,
    dto: UpdateRevenueDto
  ) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    const before = await this.getRevenueOnFarm(farmId, revenueId);
    if (
      dto.amount === undefined &&
      dto.currency === undefined &&
      dto.label === undefined &&
      dto.category === undefined &&
      dto.note === undefined &&
      dto.occurredAt === undefined
    ) {
      throw new BadRequestException("Rien a mettre a jour");
    }
    const row = await this.prisma.farmRevenue.update({
      where: { id: revenueId },
      data: {
        ...(dto.amount !== undefined
          ? { amount: new Prisma.Decimal(dto.amount) }
          : {}),
        ...(dto.currency !== undefined ? { currency: dto.currency } : {}),
        ...(dto.label !== undefined ? { label: dto.label } : {}),
        ...(dto.category !== undefined ? { category: dto.category } : {}),
        ...(dto.note !== undefined ? { note: dto.note } : {}),
        ...(dto.occurredAt !== undefined
          ? { occurredAt: new Date(dto.occurredAt) }
          : {})
      },
      include: {
        creator: { select: { id: true, fullName: true, email: true } }
      }
    });
    await this.audit.record({
      actorUserId: user.id,
      farmId,
      action: AUDIT_ACTION.financeRevenueUpdated,
      resourceType: "FarmRevenue",
      resourceId: revenueId,
      metadata: {
        before: this.revenueSnapshot(before),
        after: this.revenueSnapshot(row)
      }
    });
    return row;
  }

  async deleteRevenue(user: User, farmId: string, revenueId: string) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    const before = await this.getRevenueOnFarm(farmId, revenueId);
    await this.prisma.farmRevenue.delete({ where: { id: revenueId } });
    await this.audit.record({
      actorUserId: user.id,
      farmId,
      action: AUDIT_ACTION.financeRevenueDeleted,
      resourceType: "FarmRevenue",
      resourceId: revenueId,
      metadata: this.revenueSnapshot(before)
    });
    return { ok: true };
  }

  async summary(user: User, farmId: string, from?: string, to?: string) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    await ensureFarmFinanceBootstrap(this.prisma, farmId);
    const settings = await this.prisma.farmFinanceSettings.findUniqueOrThrow({
      where: { farmId }
    });
    const dateFilter =
      from || to
        ? {
            occurredAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {})
            }
          }
        : {};

    const [expAgg, revAgg] = await Promise.all([
      this.prisma.farmExpense.aggregate({
        where: { farmId, ...dateFilter },
        _sum: { amount: true }
      }),
      this.prisma.farmRevenue.aggregate({
        where: { farmId, ...dateFilter },
        _sum: { amount: true }
      })
    ]);

    const expenses = expAgg._sum.amount ?? new Prisma.Decimal(0);
    const revenues = revAgg._sum.amount ?? new Prisma.Decimal(0);

    return {
      farmId,
      totalExpenses: expenses.toString(),
      totalRevenues: revenues.toString(),
      net: revenues.sub(expenses).toString(),
      currency: settings.currencyCode,
      currencySymbol: settings.currencySymbol
    };
  }

  private async assertFinanceCategory(
    farmId: string,
    categoryId: string,
    type: FinanceCategoryType
  ) {
    const c = await this.prisma.financeCategory.findFirst({
      where: { id: categoryId, farmId, type }
    });
    if (!c) {
      throw new BadRequestException("Categorie finance introuvable ou type incorrect");
    }
  }

  async getFinanceSettings(user: User, farmId: string) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    await ensureFarmFinanceBootstrap(this.prisma, farmId);
    return this.prisma.farmFinanceSettings.findUniqueOrThrow({
      where: { farmId }
    });
  }

  async updateFinanceSettings(
    user: User,
    farmId: string,
    dto: {
      currencyCode?: string;
      currencySymbol?: string;
      lowBalanceThreshold?: number | null;
    }
  ) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    await ensureFarmFinanceBootstrap(this.prisma, farmId);
    return this.prisma.farmFinanceSettings.update({
      where: { farmId },
      data: {
        ...(dto.currencyCode !== undefined
          ? { currencyCode: dto.currencyCode.trim().toUpperCase() }
          : {}),
        ...(dto.currencySymbol !== undefined
          ? { currencySymbol: dto.currencySymbol.trim() }
          : {}),
        ...(dto.lowBalanceThreshold !== undefined
          ? {
              lowBalanceThreshold:
                dto.lowBalanceThreshold == null
                  ? null
                  : new Prisma.Decimal(dto.lowBalanceThreshold)
            }
          : {})
      }
    });
  }

  async listFinanceCategories(user: User, farmId: string) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    await ensureFarmFinanceBootstrap(this.prisma, farmId);
    return this.prisma.financeCategory.findMany({
      where: { farmId },
      orderBy: [{ type: "asc" }, { name: "asc" }]
    });
  }

  async createCustomFinanceCategory(
    user: User,
    farmId: string,
    body: {
      type: FinanceCategoryType;
      key: string;
      name: string;
      icon?: string | null;
    }
  ) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    await ensureFarmFinanceBootstrap(this.prisma, farmId);
    const key = body.key.trim().toLowerCase().replace(/\s+/g, "_");
    if (!key.length) {
      throw new BadRequestException("Cle categorie invalide");
    }
    return this.prisma.financeCategory.create({
      data: {
        farmId,
        type: body.type,
        key,
        name: body.name.trim(),
        icon: body.icon?.trim() || null,
        isDefault: false
      }
    });
  }

  async deleteFinanceCategory(user: User, farmId: string, categoryId: string) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    const row = await this.prisma.financeCategory.findFirst({
      where: { id: categoryId, farmId }
    });
    if (!row) {
      throw new NotFoundException("Categorie introuvable");
    }
    if (row.isDefault) {
      throw new BadRequestException("Impossible de supprimer une categorie par defaut");
    }
    await this.prisma.financeCategory.delete({ where: { id: categoryId } });
    return { ok: true };
  }

  async financeOverview(user: User, farmId: string) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    await ensureFarmFinanceBootstrap(this.prisma, farmId);
    const settings = await this.prisma.farmFinanceSettings.findUniqueOrThrow({
      where: { farmId }
    });

    const now = new Date();
    const monthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
    );
    const monthEnd = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)
    );

    const [monthExp, monthRev, allExp, allRev, months3] = await Promise.all([
      this.prisma.farmExpense.aggregate({
        where: {
          farmId,
          occurredAt: { gte: monthStart, lt: monthEnd }
        },
        _sum: { amount: true }
      }),
      this.prisma.farmRevenue.aggregate({
        where: {
          farmId,
          occurredAt: { gte: monthStart, lt: monthEnd }
        },
        _sum: { amount: true }
      }),
      this.prisma.farmExpense.aggregate({
        where: { farmId },
        _sum: { amount: true }
      }),
      this.prisma.farmRevenue.aggregate({
        where: { farmId },
        _sum: { amount: true }
      }),
      this.financeTimeseriesLast3Months(farmId)
    ]);

    const te = monthExp._sum.amount ?? new Prisma.Decimal(0);
    const tr = monthRev._sum.amount ?? new Prisma.Decimal(0);
    const allE = allExp._sum.amount ?? new Prisma.Decimal(0);
    const allR = allRev._sum.amount ?? new Prisma.Decimal(0);
    const balance = allR.sub(allE);
    const threshold = settings.lowBalanceThreshold;
    const lowBalanceWarning = Boolean(
      threshold != null && balance.lt(threshold)
    );

    return {
      farmId,
      settings: {
        currencyCode: settings.currencyCode,
        currencySymbol: settings.currencySymbol,
        lowBalanceThreshold: settings.lowBalanceThreshold?.toString() ?? null
      },
      month: {
        totalExpenses: te.toString(),
        totalRevenues: tr.toString(),
        netMargin: tr.sub(te).toString()
      },
      balanceAllTime: balance.toString(),
      lowBalanceWarning,
      months3
    };
  }

  private async financeTimeseriesLast3Months(farmId: string) {
    const now = new Date();
    const months: { label: string; start: Date; end: Date }[] = [];
    for (let delta = 2; delta >= 0; delta -= 1) {
      const ref = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - delta, 1)
      );
      const start = new Date(
        Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), 1)
      );
      const end = new Date(
        Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() + 1, 1)
      );
      const label = `${ref.getUTCFullYear()}-${String(ref.getUTCMonth() + 1).padStart(2, "0")}`;
      months.push({ label, start, end });
    }
    const settings = await this.prisma.farmFinanceSettings.findUniqueOrThrow({
      where: { farmId }
    });
    const series = await Promise.all(
      months.map(async ({ label, start, end }) => {
        const [exp, rev] = await Promise.all([
          this.prisma.farmExpense.aggregate({
            where: { farmId, occurredAt: { gte: start, lt: end } },
            _sum: { amount: true }
          }),
          this.prisma.farmRevenue.aggregate({
            where: { farmId, occurredAt: { gte: start, lt: end } },
            _sum: { amount: true }
          })
        ]);
        return {
          month: label,
          expenses: (exp._sum.amount ?? new Prisma.Decimal(0)).toString(),
          revenues: (rev._sum.amount ?? new Prisma.Decimal(0)).toString(),
          currency: settings.currencyCode
        };
      })
    );
    return series;
  }

  async listMergedTransactions(
    user: User,
    farmId: string,
    q: {
      type?: "income" | "expense";
      financeCategoryId?: string;
      from?: string;
      to?: string;
    }
  ) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    await ensureFarmFinanceBootstrap(this.prisma, farmId);
    const dateWhere: Prisma.DateTimeFilter = {};
    if (q.from) {
      dateWhere.gte = new Date(q.from);
    }
    if (q.to) {
      dateWhere.lte = new Date(q.to);
    }
    const hasDate = q.from || q.to;

    const expWhere: Prisma.FarmExpenseWhereInput = { farmId };
    if (hasDate) {
      expWhere.occurredAt = dateWhere;
    }
    if (q.financeCategoryId) {
      expWhere.financeCategoryId = q.financeCategoryId;
    }

    const revWhere: Prisma.FarmRevenueWhereInput = { farmId };
    if (hasDate) {
      revWhere.occurredAt = dateWhere;
    }
    if (q.financeCategoryId) {
      revWhere.financeCategoryId = q.financeCategoryId;
    }

    const [expenses, revenues] = await Promise.all([
      q.type === "income"
        ? []
        : this.prisma.farmExpense.findMany({
            where: expWhere,
            orderBy: { occurredAt: "desc" },
            include: {
              financeCategory: true,
              creator: {
                select: { id: true, fullName: true, email: true }
              }
            }
          }),
      q.type === "expense"
        ? []
        : this.prisma.farmRevenue.findMany({
            where: revWhere,
            orderBy: { occurredAt: "desc" },
            include: {
              financeCategory: true,
              creator: {
                select: { id: true, fullName: true, email: true }
              }
            }
          })
    ]);

    const mapExp = (e: (typeof expenses)[number]) => ({
      id: e.id,
      kind: "expense" as const,
      amount: e.amount.toString(),
      currency: e.currency,
      label: e.label,
      occurredAt: e.occurredAt.toISOString(),
      categoryLabel: e.financeCategory?.name ?? e.category ?? null,
      categoryKey: e.financeCategory?.key ?? null,
      financeCategoryId: e.financeCategoryId,
      linkedEntityType: e.linkedEntityType,
      linkedEntityId: e.linkedEntityId,
      attachmentUrl: e.attachmentUrl,
      note: e.note,
      creator: e.creator
    });
    const mapRev = (r: (typeof revenues)[number]) => ({
      id: r.id,
      kind: "income" as const,
      amount: r.amount.toString(),
      currency: r.currency,
      label: r.label,
      occurredAt: r.occurredAt.toISOString(),
      categoryLabel: r.financeCategory?.name ?? r.category ?? null,
      categoryKey: r.financeCategory?.key ?? null,
      financeCategoryId: r.financeCategoryId,
      linkedEntityType: r.linkedEntityType,
      linkedEntityId: r.linkedEntityId,
      attachmentUrl: r.attachmentUrl,
      note: r.note,
      creator: r.creator
    });

    const merged = [...expenses.map(mapExp), ...revenues.map(mapRev)].sort(
      (a, b) =>
        new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
    );
    return merged;
  }

  async createMergedTransaction(
    user: User,
    farmId: string,
    body: {
      type: "income" | "expense";
      financeCategoryId?: string;
      amount: number;
      currency?: string;
      label: string;
      occurredAt?: string;
      linkedEntityType?: string;
      linkedEntityId?: string;
      attachmentUrl?: string;
      note?: string;
    }
  ) {
    if (body.type === "expense") {
      return this.createExpense(user, farmId, {
        amount: body.amount,
        currency: body.currency,
        label: body.label,
        occurredAt: body.occurredAt,
        financeCategoryId: body.financeCategoryId,
        linkedEntityType: body.linkedEntityType,
        linkedEntityId: body.linkedEntityId,
        attachmentUrl: body.attachmentUrl,
        note: body.note
      });
    }
    return this.createRevenue(user, farmId, {
      amount: body.amount,
      currency: body.currency,
      label: body.label,
      occurredAt: body.occurredAt,
      financeCategoryId: body.financeCategoryId,
      linkedEntityType: body.linkedEntityType,
      linkedEntityId: body.linkedEntityId,
      attachmentUrl: body.attachmentUrl,
      note: body.note
    });
  }

  async financeReport(
    user: User,
    farmId: string,
    period: "month" | "year",
    month?: string,
    year?: string
  ) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    await ensureFarmFinanceBootstrap(this.prisma, farmId);
    const settings = await this.prisma.farmFinanceSettings.findUniqueOrThrow({
      where: { farmId }
    });
    let start: Date;
    let end: Date;
    const now = new Date();
    if (period === "month") {
      const ref =
        month && /^\d{4}-\d{2}$/.test(month)
          ? new Date(`${month}-01T00:00:00.000Z`)
          : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      start = new Date(
        Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), 1)
      );
      end = new Date(
        Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() + 1, 1)
      );
    } else {
      const y = year && /^\d{4}$/.test(year) ? Number(year) : now.getUTCFullYear();
      start = new Date(Date.UTC(y, 0, 1));
      end = new Date(Date.UTC(y + 1, 0, 1));
    }

    const [expenses, revenues] = await Promise.all([
      this.prisma.farmExpense.findMany({
        where: { farmId, occurredAt: { gte: start, lt: end } },
        include: { financeCategory: true }
      }),
      this.prisma.farmRevenue.findMany({
        where: { farmId, occurredAt: { gte: start, lt: end } },
        include: { financeCategory: true }
      })
    ]);

    const byCat = new Map<
      string,
      { label: string; expenses: Prisma.Decimal; revenues: Prisma.Decimal }
    >();

    for (const e of expenses) {
      const key = e.financeCategoryId ?? `legacy:${e.category ?? "none"}`;
      const lab = e.financeCategory?.name ?? e.category ?? "Sans categorie";
      const cur = byCat.get(key) ?? {
        label: lab,
        expenses: new Prisma.Decimal(0),
        revenues: new Prisma.Decimal(0)
      };
      cur.expenses = cur.expenses.add(e.amount);
      byCat.set(key, cur);
    }
    for (const r of revenues) {
      const key = r.financeCategoryId ?? `legacy:${r.category ?? "none"}`;
      const lab = r.financeCategory?.name ?? r.category ?? "Sans categorie";
      const cur = byCat.get(key) ?? {
        label: lab,
        expenses: new Prisma.Decimal(0),
        revenues: new Prisma.Decimal(0)
      };
      cur.revenues = cur.revenues.add(r.amount);
      byCat.set(key, cur);
    }

    const rows = [...byCat.entries()].map(([key, v]) => ({
      key,
      label: v.label,
      expenses: v.expenses.toString(),
      revenues: v.revenues.toString(),
      net: v.revenues.sub(v.expenses).toString()
    }));

    const totalExp = expenses.reduce(
      (s, e) => s.add(e.amount),
      new Prisma.Decimal(0)
    );
    const totalRev = revenues.reduce(
      (s, r) => s.add(r.amount),
      new Prisma.Decimal(0)
    );

    let monthlyEvolution:
      | { month: string; expenses: string; revenues: string; net: string }[]
      | undefined;
    let topExpenseCategories:
      | { key: string; label: string; expenses: string }[]
      | undefined;

    if (period === "year") {
      const y = start.getUTCFullYear();
      monthlyEvolution = [];
      for (let m = 0; m < 12; m += 1) {
        const ms = new Date(Date.UTC(y, m, 1));
        const me = new Date(Date.UTC(y, m + 1, 1));
        let eM = new Prisma.Decimal(0);
        let rM = new Prisma.Decimal(0);
        for (const e of expenses) {
          if (e.occurredAt >= ms && e.occurredAt < me) {
            eM = eM.add(e.amount);
          }
        }
        for (const r of revenues) {
          if (r.occurredAt >= ms && r.occurredAt < me) {
            rM = rM.add(r.amount);
          }
        }
        monthlyEvolution.push({
          month: `${y}-${String(m + 1).padStart(2, "0")}`,
          expenses: eM.toString(),
          revenues: rM.toString(),
          net: rM.sub(eM).toString()
        });
      }
      topExpenseCategories = [...rows]
        .filter((r) => new Prisma.Decimal(r.expenses).gt(0))
        .sort((a, b) =>
          new Prisma.Decimal(b.expenses).cmp(new Prisma.Decimal(a.expenses))
        )
        .slice(0, 10)
        .map((r) => ({
          key: r.key,
          label: r.label,
          expenses: r.expenses
        }));
    }

    return {
      farmId,
      period,
      range: { start: start.toISOString(), end: end.toISOString() },
      currency: settings.currencyCode,
      currencySymbol: settings.currencySymbol,
      totals: {
        expenses: totalExp.toString(),
        revenues: totalRev.toString(),
        net: totalRev.sub(totalExp).toString()
      },
      byCategory: rows,
      ...(monthlyEvolution ? { monthlyEvolution } : {}),
      ...(topExpenseCategories ? { topExpenseCategories } : {})
    };
  }

  async financeMarginByBatch(user: User, farmId: string, batchId: string) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    const batch = await this.prisma.livestockBatch.findFirst({
      where: { id: batchId, farmId }
    });
    if (!batch) {
      throw new NotFoundException("Bande introuvable");
    }

    const [revTable, exitAgg, expAgg] = await Promise.all([
      this.prisma.farmRevenue.aggregate({
        where: {
          farmId,
          linkedEntityType: "batch",
          linkedEntityId: batchId
        },
        _sum: { amount: true }
      }),
      this.prisma.livestockExit.aggregate({
        where: {
          farmId,
          batchId,
          kind: "sale"
        },
        _sum: { price: true }
      }),
      this.prisma.farmExpense.aggregate({
        where: {
          farmId,
          linkedEntityType: "batch",
          linkedEntityId: batchId
        },
        _sum: { amount: true }
      })
    ]);

    const rev =
      (revTable._sum.amount ?? new Prisma.Decimal(0)).add(
        exitAgg._sum.price ?? new Prisma.Decimal(0)
      );
    const exp = expAgg._sum.amount ?? new Prisma.Decimal(0);
    const headcount = batch.headcount;
    const margin = rev.sub(exp);
    const costPerHead =
      headcount > 0 ? exp.div(headcount) : new Prisma.Decimal(0);

    const latestW = await this.prisma.livestockBatchWeight.findFirst({
      where: { batchId },
      orderBy: { measuredAt: "desc" }
    });
    let costPerKg: string | null = null;
    if (latestW && headcount > 0) {
      const totalKg = latestW.avgWeightKg.mul(headcount);
      if (totalKg.gt(0)) {
        costPerKg = exp.div(totalKg).toString();
      }
    }

    return {
      farmId,
      batchId,
      batchName: batch.name,
      headcount,
      revenues: rev.toString(),
      expensesAllocated: exp.toString(),
      grossMargin: margin.toString(),
      costPerHead: costPerHead.toString(),
      costPerKg
    };
  }

  async financeProjection(user: User, farmId: string) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    await ensureFarmFinanceBootstrap(this.prisma, farmId);
    const settings = await this.prisma.farmFinanceSettings.findUniqueOrThrow({
      where: { farmId }
    });
    const now = new Date();
    const months: { start: Date; end: Date }[] = [];
    for (let i = 6; i >= 1; i -= 1) {
      const ref = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1)
      );
      months.push({
        start: new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), 1)),
        end: new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() + 1, 1))
      });
    }

    let sumExp = new Prisma.Decimal(0);
    let sumRev = new Prisma.Decimal(0);
    for (const { start, end } of months) {
      const [e, r] = await Promise.all([
        this.prisma.farmExpense.aggregate({
          where: { farmId, occurredAt: { gte: start, lt: end } },
          _sum: { amount: true }
        }),
        this.prisma.farmRevenue.aggregate({
          where: { farmId, occurredAt: { gte: start, lt: end } },
          _sum: { amount: true }
        })
      ]);
      sumExp = sumExp.add(e._sum.amount ?? new Prisma.Decimal(0));
      sumRev = sumRev.add(r._sum.amount ?? new Prisma.Decimal(0));
    }
    const avgExp = sumExp.div(6);
    const avgRev = sumRev.div(6);
    const proj = [1, 2, 3].map((m) => ({
      monthOffset: m,
      projectedExpenses: avgExp.toString(),
      projectedRevenues: avgRev.toString(),
      projectedNet: avgRev.sub(avgExp).toString()
    }));
    const deficitAlert = avgRev.sub(avgExp).lt(new Prisma.Decimal(0));

    return {
      farmId,
      currency: settings.currencyCode,
      basedOnMonths: 6,
      nextMonths: proj,
      deficitAlert
    };
  }

  async financeSimulation(
    user: User,
    farmId: string,
    saleHeadcount: number,
    pricePerHead: number
  ) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    if (
      !Number.isFinite(saleHeadcount) ||
      !Number.isFinite(pricePerHead) ||
      saleHeadcount < 0 ||
      pricePerHead < 0
    ) {
      throw new BadRequestException("Parametres simulation invalides");
    }
    const [allExp, allRev] = await Promise.all([
      this.prisma.farmExpense.aggregate({
        where: { farmId },
        _sum: { amount: true }
      }),
      this.prisma.farmRevenue.aggregate({
        where: { farmId },
        _sum: { amount: true }
      })
    ]);
    const e = allExp._sum.amount ?? new Prisma.Decimal(0);
    const r = allRev._sum.amount ?? new Prisma.Decimal(0);
    const current = r.sub(e);
    const delta = new Prisma.Decimal(saleHeadcount).mul(
      new Prisma.Decimal(pricePerHead)
    );
    return {
      farmId,
      currentBalance: current.toString(),
      simulatedAdditionalRevenue: delta.toString(),
      projectedBalance: current.add(delta).toString()
    };
  }

  async financeExportCsv(
    user: User,
    farmId: string,
    from?: string,
    to?: string
  ): Promise<string> {
    const rows = await this.listMergedTransactions(user, farmId, {
      from,
      to
    });
    const header =
      "type,occurredAt,amount,currency,categoryKey,categoryLabel,label,linkedEntityType,linkedEntityId,attachmentUrl\n";
    const body = rows
      .map((r) =>
        [
          r.kind,
          r.occurredAt,
          r.amount,
          r.currency,
          r.categoryKey ?? "",
          escapeCsv(r.categoryLabel ?? ""),
          escapeCsv(r.label),
          r.linkedEntityType ?? "",
          r.linkedEntityId ?? "",
          r.attachmentUrl ?? ""
        ].join(",")
      )
      .join("\n");
    return header + body;
  }

  async financeExportPdf(
    user: User,
    farmId: string,
    period: "month" | "year",
    month?: string,
    year?: string
  ): Promise<Buffer> {
    const report = await this.financeReport(user, farmId, period, month, year);
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: "A4" });
      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      doc
        .fontSize(18)
        .text(`Rapport finance — ${report.period}`, { align: "center" });
      doc.moveDown();
      doc
        .fontSize(10)
        .text(`Periode: ${report.range.start} → ${report.range.end}`, {
          align: "left"
        });
      doc.text(`Devise: ${report.currency} (${report.currencySymbol})`);
      doc.moveDown();
      doc.fontSize(12).text("Totaux", { underline: true });
      doc.fontSize(10);
      doc.text(`Revenus: ${report.totals.revenues}`);
      doc.text(`Depenses: ${report.totals.expenses}`);
      doc.text(`Net: ${report.totals.net}`);
      doc.moveDown();
      doc.fontSize(12).text("Par categorie", { underline: true });
      doc.fontSize(9);
      for (const row of report.byCategory.slice(0, 40)) {
        doc.text(
          `${row.label}: rev ${row.revenues} | dep ${row.expenses} | net ${row.net}`
        );
      }
      if ("monthlyEvolution" in report && report.monthlyEvolution?.length) {
        doc.addPage();
        doc.fontSize(12).text("Evolution mensuelle", { underline: true });
        doc.fontSize(9);
        for (const m of report.monthlyEvolution) {
          doc.text(
            `${m.month}: rev ${m.revenues} dep ${m.expenses} net ${m.net}`
          );
        }
      }
      if (
        "topExpenseCategories" in report &&
        report.topExpenseCategories?.length
      ) {
        doc.moveDown();
        doc.fontSize(12).text("Top depenses", { underline: true });
        doc.fontSize(9);
        for (const t of report.topExpenseCategories) {
          doc.text(`${t.label}: ${t.expenses}`);
        }
      }
      doc.end();
    });
  }
}

function escapeCsv(s: string): string {
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

