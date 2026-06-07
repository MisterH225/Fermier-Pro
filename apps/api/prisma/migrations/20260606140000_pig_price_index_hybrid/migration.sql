-- Indice hybride PigPrice : poids vendeur + snapshots + annonces signalées
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "indexWeight" DECIMAL(3,2) NOT NULL DEFAULT 0.1;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "completedTransactions" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "pig_price_index_snapshots" (
    "id" TEXT NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "indexValue" DECIMAL(10,2) NOT NULL,
    "confirmedCount" INTEGER NOT NULL DEFAULT 0,
    "listingCount" INTEGER NOT NULL DEFAULT 0,
    "totalWeightKg" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "isFrozen" BOOLEAN NOT NULL DEFAULT false,
    "freezeReason" TEXT,

    CONSTRAINT "pig_price_index_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "pig_price_index_snapshots_calculatedAt_idx"
  ON "pig_price_index_snapshots"("calculatedAt" DESC);

CREATE TABLE IF NOT EXISTS "PigPriceIndexFlaggedListing" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "sellerUserId" TEXT NOT NULL,
    "pricePerKg" DECIMAL(14,4) NOT NULL,
    "deviationPct" DECIMAL(8,4) NOT NULL,
    "flaggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PigPriceIndexFlaggedListing_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PigPriceIndexFlaggedListing_flaggedAt_idx"
  ON "PigPriceIndexFlaggedListing"("flaggedAt" DESC);
CREATE INDEX IF NOT EXISTS "PigPriceIndexFlaggedListing_listingId_idx"
  ON "PigPriceIndexFlaggedListing"("listingId");
