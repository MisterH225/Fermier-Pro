-- Stock aliment : coût manquant, PUMP, rapprochement finance
ALTER TABLE "FeedType"
ADD COLUMN IF NOT EXISTS "currentPumpPrice" DECIMAL(14,4);

ALTER TABLE "FeedStockMovement"
ADD COLUMN IF NOT EXISTS "totalCost" DECIMAL(14,2),
ADD COLUMN IF NOT EXISTS "isCostMissing" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "reconciliationDismissedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "FeedStockMovement_farmId_isCostMissing_idx"
ON "FeedStockMovement"("farmId", "isCostMissing");

CREATE TABLE IF NOT EXISTS "FeedReconciliationRejection" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "movementId" TEXT NOT NULL,
    "expenseId" TEXT NOT NULL,
    "rejectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rejectedByUserId" TEXT NOT NULL,

    CONSTRAINT "FeedReconciliationRejection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FeedReconciliationRejection_movementId_expenseId_key"
ON "FeedReconciliationRejection"("movementId", "expenseId");

CREATE INDEX IF NOT EXISTS "FeedReconciliationRejection_farmId_idx"
ON "FeedReconciliationRejection"("farmId");

ALTER TABLE "FeedReconciliationRejection"
ADD CONSTRAINT "FeedReconciliationRejection_farmId_fkey"
FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FeedReconciliationRejection"
ADD CONSTRAINT "FeedReconciliationRejection_movementId_fkey"
FOREIGN KEY ("movementId") REFERENCES "FeedStockMovement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FeedReconciliationRejection"
ADD CONSTRAINT "FeedReconciliationRejection_rejectedByUserId_fkey"
FOREIGN KEY ("rejectedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
