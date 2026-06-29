import type { PrismaClient } from "@prisma/client";
import { HistoricalMovementType } from "@prisma/client";
import { HISTORICAL_TO_FINANCE_CATEGORY_KEY } from "./historical-records.constants";
import { dec } from "../profitability/profitability-period.util";

export type HistoricalSummary = {
  totalIncome: number;
  totalExpense: number;
  netResult: number;
  byCategory: Record<string, number>;
  recordsCount: number;
};

export async function getHistoricalSummary(
  prisma: PrismaClient,
  farmId: string
): Promise<HistoricalSummary> {
  const records = await prisma.historicalRecord.findMany({
    where: { farmId },
    select: { movementType: true, category: true, amount: true }
  });

  let totalIncome = 0;
  let totalExpense = 0;
  const byCategory: Record<string, number> = {};

  for (const row of records) {
    const amount = dec(row.amount);
    byCategory[row.category] = (byCategory[row.category] ?? 0) + amount;
    if (row.movementType === HistoricalMovementType.income) {
      totalIncome += amount;
    } else {
      totalExpense += amount;
    }
  }

  return {
    totalIncome,
    totalExpense,
    netResult: totalIncome - totalExpense,
    byCategory,
    recordsCount: records.length
  };
}

/** Agrège les dépenses historiques par clé finance (direct/indirect). */
export async function getHistoricalExpenseByFinanceKey(
  prisma: PrismaClient,
  farmId: string
): Promise<Map<string, number>> {
  const records = await prisma.historicalRecord.findMany({
    where: { farmId, movementType: HistoricalMovementType.expense },
    select: { category: true, amount: true }
  });

  const totals = new Map<string, number>();
  for (const row of records) {
    const key = HISTORICAL_TO_FINANCE_CATEGORY_KEY[row.category];
    totals.set(key, (totals.get(key) ?? 0) + dec(row.amount));
  }
  return totals;
}

export async function getHistoricalTotalIncome(
  prisma: PrismaClient,
  farmId: string
): Promise<number> {
  const agg = await prisma.historicalRecord.aggregate({
    where: { farmId, movementType: HistoricalMovementType.income },
    _sum: { amount: true }
  });
  return dec(agg._sum.amount);
}
