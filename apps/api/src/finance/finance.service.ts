import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import type { FarmExpense, FarmRevenue, User } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { AUDIT_ACTION } from "../common/audit.constants";
import { AuditService } from "../common/audit.service";
import { FarmAccessService } from "../common/farm-access.service";
import { PrismaService } from "../prisma/prisma.service";
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
