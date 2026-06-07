import { FeedMovementKind, Prisma } from "@prisma/client";
import { daysBetweenUtc } from "../feed-stock/feed-stock-calculation.helper";

/** Recalcule le stock agrégé, les `stockAfterKg` et les métriques des contrôles. */
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

  const wp = feedType.weightPerBagKg;
  let stock = new Prisma.Decimal(0);
  let bagCount: Prisma.Decimal | null = null;
  let lastCheckAt: Date | null = null;
  let lastInAt: Date | null = null;

  for (const m of movements) {
    const stockBefore = stock;

    if (m.kind === FeedMovementKind.in && m.quantityKg) {
      stock = stock.plus(m.quantityKg);
      lastInAt = m.occurredAt;
      if (!m.stockAfterKg.equals(stock)) {
        await tx.feedStockMovement.update({
          where: { id: m.id },
          data: { stockAfterKg: stock }
        });
      }
      continue;
    }

    if (m.kind === FeedMovementKind.stock_check) {
      if (!wp || m.bagsCounted == null) {
        stock = m.stockAfterKg;
        if (m.bagsCounted != null) {
          bagCount = m.bagsCounted;
        }
        lastCheckAt = m.occurredAt;
        if (!m.stockAfterKg.equals(stock)) {
          await tx.feedStockMovement.update({
            where: { id: m.id },
            data: { stockAfterKg: stock }
          });
        }
        continue;
      }

      const counted = m.bagsCounted;
      const newStock = counted.times(wp);
      let daysSince = 1;
      if (lastCheckAt) {
        daysSince = daysBetweenUtc(lastCheckAt, m.occurredAt);
      } else if (lastInAt) {
        daysSince = daysBetweenUtc(lastInAt, m.occurredAt);
      }

      const consumedKg = stockBefore.minus(newStock);
      const consumedNum = consumedKg.toNumber();
      const daily =
        consumedNum > 0
          ? new Prisma.Decimal(consumedNum).div(daysSince)
          : new Prisma.Decimal(0);
      const wpNum = wp.toNumber();
      const prevBags =
        bagCount ??
        (wpNum > 0
          ? new Prisma.Decimal(stockBefore.toNumber() / wpNum)
          : null);
      const bagsConsumed =
        prevBags != null ? prevBags.minus(counted) : null;

      stock = newStock;
      bagCount = counted;
      lastCheckAt = m.occurredAt;

      await tx.feedStockMovement.update({
        where: { id: m.id },
        data: {
          stockAfterKg: stock,
          bagsConsumed,
          daysSinceLastCheck: daysSince,
          dailyConsumptionKg: daily
        }
      });
    }
  }

  await tx.feedType.update({
    where: { id: feedTypeId },
    data: {
      currentStockKg: stock,
      bagCountCurrent: bagCount,
      lastCheckDate: lastCheckAt
    }
  });
}
