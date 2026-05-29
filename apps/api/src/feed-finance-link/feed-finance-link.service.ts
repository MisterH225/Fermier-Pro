import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import type { User } from "@prisma/client";
import {
  FeedMovementKind,
  FeedTypeUnit,
  Prisma
} from "@prisma/client";
import { FarmAccessService } from "../common/farm-access.service";
import { FARM_SCOPE } from "../common/farm-scopes.constants";
import { ensureFarmFinanceBootstrap } from "../finance/finance-bootstrap";
import { PrismaService } from "../prisma/prisma.service";
import { SmartAlertsService } from "../smart-alerts/smart-alerts.service";
import { feedTypeColorAtIndex } from "../feed-stock/feed-type-colors";
import type { CreateFeedTypeDto } from "../feed-stock/dto/create-feed-type.dto";
import {
  lineAmountFromUnitPrice,
  quantityInputToKg
} from "./feed-stock-quantity.helper";
import type {
  CreateMovementWithTransactionDto,
  CreateTransactionWithStockDto,
  StockLineInputDto
} from "./dto/feed-finance-link.dto";

type TxClient = Prisma.TransactionClient;

@Injectable()
export class FeedFinanceLinkService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly farmAccess: FarmAccessService,
    private readonly smartAlerts: SmartAlertsService
  ) {}

  private async feedCategoryId(farmId: string) {
    await ensureFarmFinanceBootstrap(this.prisma, farmId);
    const cat = await this.prisma.financeCategory.findFirst({
      where: { farmId, type: "expense", key: "feed" }
    });
    return cat?.id ?? null;
  }

  private async resolveFeedType(
    tx: TxClient,
    user: User,
    farmId: string,
    line: StockLineInputDto
  ) {
    if (line.feedTypeId) {
      const row = await tx.feedType.findFirst({
        where: { id: line.feedTypeId, farmId }
      });
      if (!row) {
        throw new NotFoundException("Type d'aliment introuvable");
      }
      return row;
    }
    if (line.newFeedType) {
      return this.createFeedTypeInTx(tx, farmId, line.newFeedType);
    }
    throw new BadRequestException("feedTypeId ou newFeedType requis");
  }

  private async createFeedTypeInTx(
    tx: TxClient,
    farmId: string,
    dto: CreateFeedTypeDto
  ) {
    const existingCount = await tx.feedType.count({ where: { farmId } });
    return tx.feedType.create({
      data: {
        farmId,
        name: dto.name.trim(),
        unit: dto.unit,
        color: dto.color?.trim() || feedTypeColorAtIndex(existingCount),
        weightPerBagKg:
          dto.weightPerBagKg != null
            ? new Prisma.Decimal(dto.weightPerBagKg)
            : null,
        lowStockThresholdDays: dto.lowStockThresholdDays ?? 15,
      }
    });
  }

  private async createStockInLine(
    tx: TxClient,
    user: User,
    farmId: string,
    line: StockLineInputDto,
    expenseId: string,
    occurredAt: Date,
    defaultSupplier?: string
  ) {
    let feedType = await this.resolveFeedType(tx, user, farmId, line);
    const qUnit = line.quantityUnit ?? feedType.unit;
    const wp =
      line.weightPerBagKg != null
        ? new Prisma.Decimal(line.weightPerBagKg)
        : feedType.weightPerBagKg;

    const deltaKg = quantityInputToKg(line.quantityInput, qUnit, wp);
    const newStock = feedType.currentStockKg.plus(deltaKg);
    const wpNum = wp?.toNumber() ?? null;
    const newBags =
      wpNum != null && wpNum > 0
        ? new Prisma.Decimal(newStock.toNumber() / wpNum)
        : null;

    const basis = line.priceBasis ?? (qUnit === FeedTypeUnit.sac ? "sac" : "kg");
    let unitPrice: Prisma.Decimal | null = null;
    if (line.unitPrice != null && line.unitPrice >= 0) {
      unitPrice = new Prisma.Decimal(line.unitPrice);
    }

    const movement = await tx.feedStockMovement.create({
      data: {
        farmId,
        feedTypeId: feedType.id,
        kind: FeedMovementKind.in,
        quantityKg: deltaKg,
        stockAfterKg: newStock,
        supplier: (line.supplier ?? defaultSupplier)?.trim() || null,
        unitPrice,
        notes: null,
        occurredAt,
        linkedExpenseId: expenseId ? expenseId : null,
        createdByUserId: user.id
      },
      include: { feedType: { select: { id: true, name: true, unit: true } } }
    });

    await tx.feedType.update({
      where: { id: feedType.id },
      data: {
        currentStockKg: newStock,
        bagCountCurrent: newBags,
        ...(line.weightPerBagKg != null
          ? { weightPerBagKg: new Prisma.Decimal(line.weightPerBagKg) }
          : {}),
        ...(wp && !feedType.weightPerBagKg ? { weightPerBagKg: wp } : {})
      }
    });

    return movement;
  }

  async createTransactionWithStock(
    user: User,
    farmId: string,
    dto: CreateTransactionWithStockDto
  ) {
    await this.farmAccess.requireFarmScopes(user.id, farmId, [
      FARM_SCOPE.financeWrite,
      FARM_SCOPE.livestockWrite
    ]);
    const settings = await this.prisma.farmFinanceSettings.findUnique({
      where: { farmId }
    });
    const feedCatId = dto.financeCategoryId ?? (await this.feedCategoryId(farmId));
    const occurredAt = dto.occurredAt
      ? new Date(dto.occurredAt)
      : new Date();

    const recordStock = dto.recordStock !== false && (dto.stockLines?.length ?? 0) > 0;
    if (recordStock && (!dto.stockLines || dto.stockLines.length === 0)) {
      throw new BadRequestException("stockLines requis si recordStock est actif");
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const expense = await tx.farmExpense.create({
        data: {
          farmId,
          amount: new Prisma.Decimal(dto.amount),
          currency: dto.currency ?? settings?.currencyCode ?? "XOF",
          label: dto.label.trim(),
          note: dto.note?.slice(0, 2000) ?? null,
          occurredAt,
          financeCategoryId: feedCatId,
          attachmentUrl: dto.attachmentUrl ?? null,
          linkedStockMovementIds: [],
          createdByUserId: user.id
        }
      });

      const movements: Awaited<ReturnType<typeof this.createStockInLine>>[] = [];
      if (recordStock && dto.stockLines) {
        const totalLines = dto.stockLines.reduce((sum, line) => {
          const qUnit = line.quantityUnit ?? FeedTypeUnit.kg;
          const wp =
            line.weightPerBagKg != null
              ? new Prisma.Decimal(line.weightPerBagKg)
              : null;
          const kg = quantityInputToKg(line.quantityInput, qUnit, wp);
          const basis = line.priceBasis ?? (qUnit === FeedTypeUnit.sac ? "sac" : "kg");
          const price =
            line.unitPrice ??
            (kg.gt(0) ? dto.amount / kg.toNumber() : 0);
          return (
            sum +
            lineAmountFromUnitPrice(
              line.quantityInput,
              qUnit,
              kg,
              price,
              basis
            )
          );
        }, 0);
        const gap = Math.abs(totalLines - dto.amount);
        if (gap > 0.01 && dto.stockLines.length > 1) {
          // warning only — stored in response
        }

        for (const line of dto.stockLines) {
          const qUnit = line.quantityUnit ?? FeedTypeUnit.kg;
          const wp =
            line.weightPerBagKg != null
              ? new Prisma.Decimal(line.weightPerBagKg)
              : null;
          const kg = quantityInputToKg(line.quantityInput, qUnit, wp);
          const unitPrice =
            line.unitPrice ??
            (kg.gt(0) ? dto.amount / kg.toNumber() : undefined);
          movements.push(
            await this.createStockInLine(
              tx,
              user,
              farmId,
              { ...line, unitPrice },
              expense.id,
              occurredAt,
              line.supplier
            )
          );
        }

        await tx.farmExpense.update({
          where: { id: expense.id },
          data: {
            linkedStockMovementIds: movements.map((m) => m.id)
          }
        });
      }

      return { expense, movements, linesTotalWarning: null as string | null };
    });

    void this.smartAlerts.refreshInternal(farmId).catch(() => undefined);

    return {
      expense: {
        ...result.expense,
        amount: result.expense.amount.toString()
      },
      movements: result.movements.map((m) => ({
        ...m,
        quantityKg: m.quantityKg?.toString() ?? null,
        unitPrice: m.unitPrice?.toString() ?? null,
        stockAfterKg: m.stockAfterKg.toString()
      })),
      stockSummary: result.movements.map((m) => ({
        feedTypeName: m.feedType.name,
        quantityKg: m.quantityKg?.toString() ?? "0"
      }))
    };
  }

  async createMovementWithTransaction(
    user: User,
    farmId: string,
    dto: CreateMovementWithTransactionDto
  ) {
    await this.farmAccess.requireFarmScopes(user.id, farmId, [
      FARM_SCOPE.livestockWrite,
      FARM_SCOPE.financeWrite
    ]);

    if (dto.kind !== "in") {
      throw new BadRequestException(
        "Utiliser POST /feed/movements pour les contrôles de stock"
      );
    }

    const occurredAt = dto.occurredAt ? new Date(dto.occurredAt) : new Date();
    const settings = await this.prisma.farmFinanceSettings.findUnique({
      where: { farmId }
    });

    const result = await this.prisma.$transaction(async (tx) => {
      let expenseId: string | null = null;
      let expense: { id: string; amount: Prisma.Decimal } | null = null;

      const line: StockLineInputDto = {
        feedTypeId: dto.feedTypeId,
        newFeedType: dto.newFeedType,
        quantityInput: dto.quantityInput!,
        quantityUnit: dto.quantityUnit,
        weightPerBagKg: dto.weightPerBagKg,
        unitPrice: dto.unitPrice,
        priceBasis: dto.priceBasis,
        supplier: dto.supplier
      };

      if (
        dto.createFinanceExpense !== false &&
        dto.unitPrice != null &&
        dto.quantityInput != null
      ) {
        const feedType = await this.resolveFeedType(tx, user, farmId, line);
        const qUnit = dto.quantityUnit ?? feedType.unit;
        const wp =
          dto.weightPerBagKg != null
            ? new Prisma.Decimal(dto.weightPerBagKg)
            : feedType.weightPerBagKg;
        const deltaKg = quantityInputToKg(dto.quantityInput, qUnit, wp);
        const basis = dto.priceBasis ?? (qUnit === FeedTypeUnit.sac ? "sac" : "kg");
        const amount = lineAmountFromUnitPrice(
          dto.quantityInput,
          qUnit,
          deltaKg,
          dto.unitPrice,
          basis
        );
        if (amount > 0) {
          const catId = await this.feedCategoryId(farmId);
          expense = await tx.farmExpense.create({
            data: {
              farmId,
              amount: new Prisma.Decimal(amount),
              currency: settings?.currencyCode ?? "XOF",
              label:
                dto.financeLabel?.trim() ||
                `Aliment : ${feedType.name}`,
              note: dto.notes?.slice(0, 500) ?? null,
              occurredAt,
              financeCategoryId: catId,
              linkedStockMovementIds: [],
              createdByUserId: user.id
            }
          });
          expenseId = expense.id;
        }
      }

      const movement = await this.createStockInLine(
        tx,
        user,
        farmId,
        line,
        expenseId ?? "",
        occurredAt,
        dto.supplier
      );

      if (expense) {
        await tx.farmExpense.update({
          where: { id: expense.id },
          data: { linkedStockMovementIds: [movement.id] }
        });
        await tx.feedStockMovement.update({
          where: { id: movement.id },
          data: { linkedExpenseId: expense.id }
        });
      }

      return { movement, expense };
    });

    void this.smartAlerts.refreshInternal(farmId).catch(() => undefined);

    return {
      movement: {
        ...result.movement,
        quantityKg: result.movement.quantityKg?.toString() ?? null,
        unitPrice: result.movement.unitPrice?.toString() ?? null
      },
      expense: result.expense
        ? {
            id: result.expense.id,
            amount: result.expense.amount.toString()
          }
        : null
    };
  }

  async getLinkedStockForExpense(user: User, farmId: string, expenseId: string) {
    await this.farmAccess.requireFarmScopes(user.id, farmId, [
      FARM_SCOPE.financeRead
    ]);
    const expense = await this.prisma.farmExpense.findFirst({
      where: { id: expenseId, farmId }
    });
    if (!expense) {
      throw new NotFoundException("Dépense introuvable");
    }
    const ids = expense.linkedStockMovementIds ?? [];
    if (ids.length === 0) {
      return { expenseId, movements: [] };
    }
    const movements = await this.prisma.feedStockMovement.findMany({
      where: { id: { in: ids }, farmId },
      include: { feedType: { select: { id: true, name: true, unit: true } } }
    });
    return {
      expenseId,
      movements: movements.map((m) => ({
        id: m.id,
        feedTypeId: m.feedTypeId,
        feedTypeName: m.feedType.name,
        quantityKg: m.quantityKg?.toString() ?? null,
        unitPrice: m.unitPrice?.toString() ?? null,
        supplier: m.supplier,
        occurredAt: m.occurredAt.toISOString()
      }))
    };
  }

  async getLinkedTransactionForMovement(
    user: User,
    farmId: string,
    movementId: string
  ) {
    await this.farmAccess.requireFarmScopes(user.id, farmId, [
      FARM_SCOPE.livestockRead
    ]);
    const movement = await this.prisma.feedStockMovement.findFirst({
      where: { id: movementId, farmId }
    });
    if (!movement) {
      throw new NotFoundException("Mouvement introuvable");
    }
    if (!movement.linkedExpenseId) {
      return { movementId, expense: null };
    }
    const expense = await this.prisma.farmExpense.findFirst({
      where: { id: movement.linkedExpenseId, farmId },
      include: { financeCategory: true }
    });
    if (!expense) {
      return { movementId, expense: null };
    }
    return {
      movementId,
      expense: {
        id: expense.id,
        amount: expense.amount.toString(),
        currency: expense.currency,
        label: expense.label,
        occurredAt: expense.occurredAt.toISOString(),
        categoryKey: expense.financeCategory?.key ?? null
      }
    };
  }

  async deleteExpenseWithStock(
    user: User,
    farmId: string,
    expenseId: string,
    deleteStock: boolean
  ) {
    await this.farmAccess.requireFarmScopes(user.id, farmId, [
      FARM_SCOPE.financeWrite
    ]);
    const expense = await this.prisma.farmExpense.findFirst({
      where: { id: expenseId, farmId }
    });
    if (!expense) {
      throw new NotFoundException("Dépense introuvable");
    }

    await this.prisma.$transaction(async (tx) => {
      if (deleteStock && expense.linkedStockMovementIds.length > 0) {
        for (const movId of expense.linkedStockMovementIds) {
          const mov = await tx.feedStockMovement.findFirst({
            where: { id: movId, farmId, kind: FeedMovementKind.in }
          });
          if (!mov || !mov.quantityKg) {
            continue;
          }
          const ft = await tx.feedType.findUnique({
            where: { id: mov.feedTypeId }
          });
          if (!ft) {
            continue;
          }
          const newStock = Prisma.Decimal.max(
            new Prisma.Decimal(0),
            ft.currentStockKg.minus(mov.quantityKg)
          );
          await tx.feedType.update({
            where: { id: ft.id },
            data: { currentStockKg: newStock }
          });
          await tx.feedStockMovement.delete({ where: { id: movId } });
        }
      } else if (expense.linkedStockMovementIds.length > 0) {
        await tx.feedStockMovement.updateMany({
          where: { id: { in: expense.linkedStockMovementIds } },
          data: { linkedExpenseId: null }
        });
      }
      await tx.farmExpense.delete({ where: { id: expenseId } });
    });

    void this.smartAlerts.refreshInternal(farmId).catch(() => undefined);
    return { ok: true, deletedStock: deleteStock };
  }

  async syncLinkedStockFromExpense(
    user: User,
    farmId: string,
    expenseId: string
  ) {
    await this.farmAccess.requireFarmScopes(user.id, farmId, [
      FARM_SCOPE.financeWrite
    ]);
    const expense = await this.prisma.farmExpense.findFirst({
      where: { id: expenseId, farmId }
    });
    if (!expense || expense.linkedStockMovementIds.length === 0) {
      throw new NotFoundException("Aucun stock lié");
    }

    const totalKg = await this.prisma.feedStockMovement.aggregate({
      where: { id: { in: expense.linkedStockMovementIds } },
      _sum: { quantityKg: true }
    });
    const kg = Number(totalKg._sum.quantityKg?.toString() ?? 0);
    const amount = Number(expense.amount.toString());
    if (kg <= 0) {
      return { updated: 0 };
    }
    const unitPrice = amount / kg;

    await this.prisma.feedStockMovement.updateMany({
      where: { id: { in: expense.linkedStockMovementIds } },
      data: { unitPrice: new Prisma.Decimal(unitPrice) }
    });

    return { updated: expense.linkedStockMovementIds.length, unitPricePerKg: unitPrice };
  }
}
