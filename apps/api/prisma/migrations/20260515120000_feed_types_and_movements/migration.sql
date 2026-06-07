-- Stock aliment : types + mouvements (remplace FeedStockLot).

CREATE TYPE "FeedTypeUnit" AS ENUM ('kg', 'tonne', 'sac');
CREATE TYPE "FeedMovementKind" AS ENUM ('in', 'stock_check');

DROP TABLE IF EXISTS "FeedStockLot";

CREATE TABLE "FeedType" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" "FeedTypeUnit" NOT NULL DEFAULT 'kg',
    "lowStockThresholdDays" INTEGER NOT NULL DEFAULT 15,
    "color" TEXT NOT NULL DEFAULT '#5d7a1f',
    "weightPerBagKg" DECIMAL(12,4),
    "bagCountCurrent" DECIMAL(14,4),
    "lastCheckDate" TIMESTAMP(3),
    "currentStockKg" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedType_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FeedStockMovement" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "feedTypeId" TEXT NOT NULL,
    "kind" "FeedMovementKind" NOT NULL,
    "quantityKg" DECIMAL(14,4),
    "bagsCounted" DECIMAL(14,4),
    "bagsConsumed" DECIMAL(14,4),
    "daysSinceLastCheck" INTEGER,
    "dailyConsumptionKg" DECIMAL(14,6),
    "stockAfterKg" DECIMAL(14,4) NOT NULL,
    "supplier" TEXT,
    "unitPrice" DECIMAL(14,2),
    "notes" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "linkedExpenseId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedStockMovement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FeedType_farmId_idx" ON "FeedType"("farmId");
CREATE INDEX "FeedStockMovement_farmId_occurredAt_idx" ON "FeedStockMovement"("farmId", "occurredAt");
CREATE INDEX "FeedStockMovement_feedTypeId_occurredAt_idx" ON "FeedStockMovement"("feedTypeId", "occurredAt");

ALTER TABLE "FeedType" ADD CONSTRAINT "FeedType_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FeedStockMovement" ADD CONSTRAINT "FeedStockMovement_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FeedStockMovement" ADD CONSTRAINT "FeedStockMovement_feedTypeId_fkey" FOREIGN KEY ("feedTypeId") REFERENCES "FeedType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FeedStockMovement" ADD CONSTRAINT "FeedStockMovement_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
