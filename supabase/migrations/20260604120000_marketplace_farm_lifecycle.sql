ALTER TYPE "ListingStatus" ADD VALUE IF NOT EXISTS 'paused';

ALTER TYPE "OfferStatus" ADD VALUE IF NOT EXISTS 'on_hold';
ALTER TYPE "OfferStatus" ADD VALUE IF NOT EXISTS 'cancelled';

DO $$ BEGIN
  CREATE TYPE "PigPriceSnapshotSource" AS ENUM ('listing', 'direct_sale');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "PigPriceSnapshot" (
    "id" TEXT NOT NULL,
    "category" "PigPriceIndexCategory" NOT NULL,
    "pricePerKg" DECIMAL(14,4) NOT NULL,
    "weightKg" DECIMAL(14,4) NOT NULL,
    "soldAt" TIMESTAMP(3) NOT NULL,
    "source" "PigPriceSnapshotSource" NOT NULL DEFAULT 'listing',
    "farmId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PigPriceSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PigPriceSnapshot_soldAt_idx" ON "PigPriceSnapshot"("soldAt" DESC);
CREATE INDEX IF NOT EXISTS "PigPriceSnapshot_category_soldAt_idx" ON "PigPriceSnapshot"("category", "soldAt" DESC);
CREATE INDEX IF NOT EXISTS "PigPriceSnapshot_farmId_idx" ON "PigPriceSnapshot"("farmId");

DO $$ BEGIN
  ALTER TABLE "PigPriceSnapshot" ADD CONSTRAINT "PigPriceSnapshot_farmId_fkey"
    FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
