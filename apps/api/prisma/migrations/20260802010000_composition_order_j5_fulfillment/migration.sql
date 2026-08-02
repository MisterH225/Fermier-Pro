-- P-J5 : remise (retrait/livraison), fenêtre litige, Delivery, dispute, libération escrow

ALTER TYPE "CompositionOrderStatus" ADD VALUE IF NOT EXISTS 'DISPUTED';
ALTER TYPE "CompositionOrderStatus" ADD VALUE IF NOT EXISTS 'REFUNDED';

DO $$ BEGIN
  CREATE TYPE "CompositionFulfillmentMode" AS ENUM ('PICKUP', 'DELIVERY');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "DeliveryStatus" AS ENUM ('scheduled', 'out', 'delivered');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "CompositionOrderDisputeStatus" AS ENUM ('open', 'resolved_seller', 'resolved_buyer', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "CompositionOrder"
  ADD COLUMN IF NOT EXISTS "fulfillmentMode" "CompositionFulfillmentMode" NOT NULL DEFAULT 'PICKUP',
  ADD COLUMN IF NOT EXISTS "confirmedReceivedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "disputeWindowEndsAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "escrowReleasedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "disputeOpenedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "CompositionOrder_status_disputeWindowEndsAt_idx"
  ON "CompositionOrder"("status", "disputeWindowEndsAt");

CREATE TABLE IF NOT EXISTS "Delivery" (
  "id" TEXT NOT NULL,
  "compositionOrderId" TEXT,
  "merchantOrderId" TEXT,
  "marketplaceTransactionId" TEXT,
  "status" "DeliveryStatus" NOT NULL DEFAULT 'scheduled',
  "feeXof" DECIMAL(14,2) NOT NULL,
  "note" TEXT,
  "scheduledAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Delivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Delivery_compositionOrderId_key" ON "Delivery"("compositionOrderId");
CREATE UNIQUE INDEX IF NOT EXISTS "Delivery_merchantOrderId_key" ON "Delivery"("merchantOrderId");
CREATE UNIQUE INDEX IF NOT EXISTS "Delivery_marketplaceTransactionId_key" ON "Delivery"("marketplaceTransactionId");
CREATE INDEX IF NOT EXISTS "Delivery_status_idx" ON "Delivery"("status");

DO $$ BEGIN
  ALTER TABLE "Delivery"
    ADD CONSTRAINT "Delivery_compositionOrderId_fkey"
    FOREIGN KEY ("compositionOrderId") REFERENCES "CompositionOrder"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "CompositionOrderDispute" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "openedByUserId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "millNote" TEXT,
  "producerNote" TEXT,
  "status" "CompositionOrderDisputeStatus" NOT NULL DEFAULT 'open',
  "resolvedAt" TIMESTAMP(3),
  "resolvedByUserId" TEXT,
  "resolutionNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CompositionOrderDispute_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CompositionOrderDispute_orderId_key" ON "CompositionOrderDispute"("orderId");
CREATE INDEX IF NOT EXISTS "CompositionOrderDispute_openedByUserId_createdAt_idx"
  ON "CompositionOrderDispute"("openedByUserId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "CompositionOrderDispute_status_idx" ON "CompositionOrderDispute"("status");

DO $$ BEGIN
  ALTER TABLE "CompositionOrderDispute"
    ADD CONSTRAINT "CompositionOrderDispute_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "CompositionOrder"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CompositionOrderDispute"
    ADD CONSTRAINT "CompositionOrderDispute_openedByUserId_fkey"
    FOREIGN KEY ("openedByUserId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Aligné revoke_postgrest_table_access : API Nest uniquement
REVOKE ALL ON TABLE "Delivery" FROM anon, authenticated;
REVOKE ALL ON TABLE "CompositionOrderDispute" FROM anon, authenticated;
ALTER TABLE "Delivery" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CompositionOrderDispute" ENABLE ROW LEVEL SECURITY;
