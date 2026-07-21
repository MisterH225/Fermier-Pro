DO $$ BEGIN
  CREATE TYPE "MerchantOrderStatus" AS ENUM ('pending');
EXCEPTION WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

-- Merchant dashboard: vues produit, statuts commande litige/terminée, litiges boutique

DO $$ BEGIN
  CREATE TYPE "MerchantOrderDisputeStatus" AS ENUM ('open', 'resolved_seller', 'resolved_buyer', 'closed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TYPE "MerchantOrderStatus" ADD VALUE IF NOT EXISTS 'disputed';
ALTER TYPE "MerchantOrderStatus" ADD VALUE IF NOT EXISTS 'completed';

DO $$ BEGIN
  ALTER TABLE "MerchantProduct" ADD COLUMN IF NOT EXISTS "viewCount" INTEGER NOT NULL DEFAULT 0;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "MerchantOrder" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMPTZ;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
CREATE TABLE IF NOT EXISTS "MerchantOrderDispute" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "openedByUserId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "sellerNote" TEXT,
    "buyerNote" TEXT,
    "status" "MerchantOrderDisputeStatus" NOT NULL DEFAULT 'open',
    "resolvedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "MerchantOrderDispute_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MerchantOrderDispute_orderId_key" ON "MerchantOrderDispute"("orderId");
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "MerchantOrderDispute_openedByUserId_createdAt_idx" ON "MerchantOrderDispute"("openedByUserId", "createdAt" DESC);
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "MerchantOrderDispute_status_idx" ON "MerchantOrderDispute"("status");
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "MerchantOrderDispute" DROP CONSTRAINT IF EXISTS "MerchantOrderDispute_orderId_fkey";
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "MerchantOrderDispute" ADD CONSTRAINT "MerchantOrderDispute_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "MerchantOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "MerchantOrderDispute" DROP CONSTRAINT IF EXISTS "MerchantOrderDispute_openedByUserId_fkey";
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "MerchantOrderDispute" ADD CONSTRAINT "MerchantOrderDispute_openedByUserId_fkey" FOREIGN KEY ("openedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;