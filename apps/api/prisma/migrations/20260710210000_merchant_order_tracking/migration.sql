-- MerchantOrder tracking: escrow différé + machine à états livraison

ALTER TYPE "MerchantOrderStatus" ADD VALUE IF NOT EXISTS 'confirmed';
ALTER TYPE "MerchantOrderStatus" ADD VALUE IF NOT EXISTS 'shipping';
ALTER TYPE "MerchantOrderStatus" ADD VALUE IF NOT EXISTS 'delivered';
ALTER TYPE "MerchantOrderStatus" ADD VALUE IF NOT EXISTS 'rejected';
ALTER TYPE "MerchantOrderStatus" ADD VALUE IF NOT EXISTS 'auto_rejected';
ALTER TYPE "MerchantOrderStatus" ADD VALUE IF NOT EXISTS 'refunded';

ALTER TABLE "MerchantOrder"
  ADD COLUMN IF NOT EXISTS "escrowHeld" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "confirmedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "shippedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deliveredAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "rejectedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "disputeOpenedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "resolvedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "resolvedByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "resolutionNote" TEXT,
  ADD COLUMN IF NOT EXISTS "timeoutAt" TIMESTAMP(3);

-- Commandes déjà payées / clôturées : escrow déjà versé (legacy)
UPDATE "MerchantOrder"
SET "escrowHeld" = false
WHERE "status" IN ('paid', 'completed', 'disputed', 'cancelled', 'failed', 'refunded');

CREATE INDEX IF NOT EXISTS "MerchantOrder_status_timeoutAt_idx"
  ON "MerchantOrder"("status", "timeoutAt");
CREATE INDEX IF NOT EXISTS "MerchantOrder_status_deliveredAt_idx"
  ON "MerchantOrder"("status", "deliveredAt");

CREATE TABLE IF NOT EXISTS "MerchantOrderEvent" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "fromStatus" "MerchantOrderStatus",
  "toStatus" "MerchantOrderStatus" NOT NULL,
  "actorUserId" TEXT,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MerchantOrderEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MerchantOrderEvent_orderId_createdAt_idx"
  ON "MerchantOrderEvent"("orderId", "createdAt" ASC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MerchantOrderEvent_orderId_fkey'
  ) THEN
    ALTER TABLE "MerchantOrderEvent"
      ADD CONSTRAINT "MerchantOrderEvent_orderId_fkey"
      FOREIGN KEY ("orderId") REFERENCES "MerchantOrder"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "MerchantOrderDispute"
  ADD COLUMN IF NOT EXISTS "resolvedByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "resolutionNote" TEXT;
