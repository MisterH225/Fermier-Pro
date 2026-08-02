-- P-J5 : remise / litige / Delivery.
-- Sur Supabase Preview, CompositionOrder n'existe pas encore (migration escrow
-- en no-op — tables créées via Prisma sur le remote). On n'applique le DDL
-- que si le type de base est présent ; sinon no-op pour le cold replay.

DO $$
BEGIN
  IF to_regtype('public."CompositionOrderStatus"') IS NULL THEN
    RAISE NOTICE 'CompositionOrderStatus absent — skip J5 (preview cold replay)';
    RETURN;
  END IF;

  ALTER TYPE "CompositionOrderStatus" ADD VALUE IF NOT EXISTS 'DISPUTED';
  ALTER TYPE "CompositionOrderStatus" ADD VALUE IF NOT EXISTS 'REFUNDED';
END $$;

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

DO $$
BEGIN
  IF to_regclass('public."CompositionOrder"') IS NULL THEN
    RAISE NOTICE 'CompositionOrder absent — skip J5 tables (preview cold replay)';
    RETURN;
  END IF;

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

  BEGIN
    ALTER TABLE "Delivery"
      ADD CONSTRAINT "Delivery_compositionOrderId_fkey"
      FOREIGN KEY ("compositionOrderId") REFERENCES "CompositionOrder"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

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

  BEGIN
    ALTER TABLE "CompositionOrderDispute"
      ADD CONSTRAINT "CompositionOrderDispute_orderId_fkey"
      FOREIGN KEY ("orderId") REFERENCES "CompositionOrder"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER TABLE "CompositionOrderDispute"
      ADD CONSTRAINT "CompositionOrderDispute_openedByUserId_fkey"
      FOREIGN KEY ("openedByUserId") REFERENCES "User"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  REVOKE ALL ON TABLE "Delivery" FROM anon, authenticated;
  REVOKE ALL ON TABLE "CompositionOrderDispute" FROM anon, authenticated;
  ALTER TABLE "Delivery" ENABLE ROW LEVEL SECURITY;
  ALTER TABLE "CompositionOrderDispute" ENABLE ROW LEVEL SECURITY;
END $$;
