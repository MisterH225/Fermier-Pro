-- PigPrice Index daily aggregated table (mirrors Prisma migration)
CREATE TYPE "PigPriceIndexCategory" AS ENUM ('porcelet', 'croissance', 'charcutier', 'reproducteur', 'global');

CREATE TABLE IF NOT EXISTS "PigPriceIndexDaily" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "category" "PigPriceIndexCategory" NOT NULL,
    "avgPricePerKg" DECIMAL(14,4) NOT NULL,
    "weightedAvgPrice" DECIMAL(14,4) NOT NULL,
    "minPrice" DECIMAL(14,4),
    "maxPrice" DECIMAL(14,4),
    "transactionCount" INTEGER NOT NULL DEFAULT 0,
    "listingAvgPrice" DECIMAL(14,4),
    "listingCount" INTEGER NOT NULL DEFAULT 0,
    "variationPct" DECIMAL(8,4),
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PigPriceIndexDaily_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PigPriceIndexDaily_date_category_key"
  ON "PigPriceIndexDaily"("date", "category");

CREATE INDEX IF NOT EXISTS "PigPriceIndexDaily_date_idx"
  ON "PigPriceIndexDaily"("date" DESC);
