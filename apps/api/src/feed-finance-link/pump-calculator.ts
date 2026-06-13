import { Injectable } from "@nestjs/common";
import { FeedMovementKind, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  movementQuantityKg,
  resolveMovementTotalCost,
  startOfUtcMonth,
  unitPricePerKgFromTotal
} from "./feed-movement-cost.helper";

@Injectable()
export class PumpCalculator {
  constructor(private readonly prisma: PrismaService) {}

  /** PUMP = SUM(coût) / SUM(kg) sur les entrées du mois UTC avec coût connu. */
  async recalculateForFeedType(
    tx: Prisma.TransactionClient | PrismaService,
    farmId: string,
    feedTypeId: string
  ): Promise<number | null> {
    const monthStart = startOfUtcMonth(new Date());
    const movements = await tx.feedStockMovement.findMany({
      where: {
        farmId,
        feedTypeId,
        kind: FeedMovementKind.in,
        occurredAt: { gte: monthStart }
      },
      select: {
        quantityKg: true,
        totalCost: true,
        unitPrice: true,
        linkedExpenseId: true
      }
    });

    if (movements.length === 0) {
      await tx.feedType.update({
        where: { id: feedTypeId },
        data: { currentPumpPrice: null }
      });
      return null;
    }

    const expenseIds = movements
      .map((m) => m.linkedExpenseId)
      .filter((id): id is string => Boolean(id));
    const expenses =
      expenseIds.length > 0
        ? await tx.farmExpense.findMany({
            where: { id: { in: expenseIds }, farmId },
            select: { id: true, amount: true }
          })
        : [];
    const expenseById = new Map(expenses.map((e) => [e.id, e]));

    let sumCost = 0;
    let sumKg = 0;
    for (const m of movements) {
      const kg = movementQuantityKg(m);
      if (kg <= 0) {
        continue;
      }
      const cost = resolveMovementTotalCost(
        m,
        m.linkedExpenseId ? expenseById.get(m.linkedExpenseId) : null
      );
      if (cost == null || cost <= 0) {
        continue;
      }
      sumCost += cost;
      sumKg += kg;
    }

    const pump = unitPricePerKgFromTotal(sumCost, sumKg);
    await tx.feedType.update({
      where: { id: feedTypeId },
      data: {
        currentPumpPrice:
          pump != null ? new Prisma.Decimal(pump) : null
      }
    });
    return pump;
  }
}
