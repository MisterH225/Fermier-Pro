import { Injectable } from "@nestjs/common";
import type { User } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { AUDIT_ACTION } from "../common/audit.constants";
import { AuditService } from "../common/audit.service";
import { FarmAccessService } from "../common/farm-access.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreateExpenseDto } from "./dto/create-expense.dto";
import { CreateRevenueDto } from "./dto/create-revenue.dto";

@Injectable()
export class FinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly farmAccess: FarmAccessService,
    private readonly audit: AuditService
  ) {}

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
    const row = await this.prisma.farmExpense.create({
      data: {
        farmId,
        amount: new Prisma.Decimal(dto.amount),
        currency: dto.currency ?? "XOF",
        label: dto.label,
        category: dto.category,
        note: dto.note,
        occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : new Date(),
        createdByUserId: user.id
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
    const row = await this.prisma.farmRevenue.create({
      data: {
        farmId,
        amount: new Prisma.Decimal(dto.amount),
        currency: dto.currency ?? "XOF",
        label: dto.label,
        category: dto.category,
        note: dto.note,
        occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : new Date(),
        createdByUserId: user.id
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

  async summary(user: User, farmId: string, from?: string, to?: string) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
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
      currency: "XOF"
    };
  }
}
