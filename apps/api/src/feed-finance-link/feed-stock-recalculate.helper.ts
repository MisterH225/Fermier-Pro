import { FeedMovementKind, Prisma } from "@prisma/client";

/** Recalcule le stock agrégé et les `stockAfterKg` après modification/suppression. */
export async function recalculateFeedTypeStock(
  tx: Prisma.TransactionClient,
  farmId: string,
  feedTypeId: string
): Promise<void> {
  const feedType = await tx.feedType.findFirst({
    where: { id: feedTypeId, farmId }
  });
  if (!feedType) {
    return;
  }

  const movements = await tx.feedStockMovement.findMany({
    where: { farmId, feedTypeId },
    orderBy: [{ occurredAt: "asc" }, { id: "asc" }]
  });

  let stock = new Prisma.Decimal(0);
  let bagCount: Prisma.Decimal | null = feedType.bagCountCurrent;
  let lastCheck: Date | null = feedType.lastCheckDate;

  for (const m of movements) {
    if (m.kind === FeedMovementKind.in && m.quantityKg) {
      stock = stock.plus(m.quantityKg);
    } else if (m.kind === FeedMovementKind.stock_check) {
      stock = m.stockAfterKg;
      if (m.bagsCounted != null) {
        bagCount = m.bagsCounted;
      }
      lastCheck = m.occurredAt;
    }

    if (!m.stockAfterKg.equals(stock)) {
      await tx.feedStockMovement.update({
        where: { id: m.id },
        data: { stockAfterKg: stock }
      });
    }
  }

  await tx.feedType.update({
    where: { id: feedTypeId },
    data: {
      currentStockKg: stock,
      bagCountCurrent: bagCount,
      lastCheckDate: lastCheck
    }
  });
}
