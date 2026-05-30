import type { FeedStockMovement, FeedType } from "@prisma/client";

type MovementWithType = FeedStockMovement & {
  feedType?: Pick<FeedType, "id" | "name" | "unit">;
};

export function serializeFeedMovement(row: MovementWithType) {
  return {
    ...row,
    quantityKg: row.quantityKg?.toString() ?? null,
    bagsCounted: row.bagsCounted?.toString() ?? null,
    bagsConsumed: row.bagsConsumed?.toString() ?? null,
    dailyConsumptionKg: row.dailyConsumptionKg?.toString() ?? null,
    stockAfterKg: row.stockAfterKg.toString(),
    unitPrice: row.unitPrice?.toString() ?? null,
    totalCost: row.totalCost?.toString() ?? null,
    occurredAt: row.occurredAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    reconciliationDismissedAt:
      row.reconciliationDismissedAt?.toISOString() ?? null
  };
}
