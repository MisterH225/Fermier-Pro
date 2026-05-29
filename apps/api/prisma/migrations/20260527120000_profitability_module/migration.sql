CREATE TYPE "FeedProductionPhase" AS ENUM ('starter', 'growth', 'fattening', 'breeder', 'unknown');

ALTER TABLE "FeedType" ADD COLUMN "productionPhase" "FeedProductionPhase" NOT NULL DEFAULT 'unknown';

CREATE TABLE "FarmProfitabilitySettings" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "marketPricePerKg" DECIMAL(14,4),
    "icTargetStarter" DECIMAL(6,3) NOT NULL DEFAULT 1.8,
    "icTargetGrowth" DECIMAL(6,3) NOT NULL DEFAULT 2.8,
    "icTargetFattening" DECIMAL(6,3) NOT NULL DEFAULT 3.2,
    "gmqRefStarter" INTEGER NOT NULL DEFAULT 300,
    "gmqRefGrowth" INTEGER NOT NULL DEFAULT 450,
    "gmqRefFattening" INTEGER NOT NULL DEFAULT 650,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FarmProfitabilitySettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProfitabilitySnapshot" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "periodMonth" INTEGER NOT NULL,
    "periodYear" INTEGER NOT NULL,
    "totalCosts" DECIMAL(16,2) NOT NULL,
    "feedCostByPhase" JSONB NOT NULL,
    "healthCost" DECIMAL(16,2) NOT NULL,
    "fixedCosts" DECIMAL(16,2) NOT NULL,
    "breederCostImputed" DECIMAL(16,2) NOT NULL,
    "otherCosts" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "kgSoldReal" DECIMAL(14,4) NOT NULL,
    "kgEstimatedInStock" DECIMAL(14,4) NOT NULL,
    "avgSalePricePerKg" DECIMAL(14,4),
    "costPerKgSold" DECIMAL(14,4),
    "costPerKgProduced" DECIMAL(14,4),
    "marginPerKg" DECIMAL(14,4),
    "icByPhase" JSONB NOT NULL,
    "herdValueEstimated" DECIMAL(16,2),
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfitabilitySnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FarmProfitabilitySettings_farmId_key" ON "FarmProfitabilitySettings"("farmId");
CREATE UNIQUE INDEX "ProfitabilitySnapshot_farmId_periodYear_periodMonth_key" ON "ProfitabilitySnapshot"("farmId", "periodYear", "periodMonth");
CREATE INDEX "ProfitabilitySnapshot_farmId_periodYear_periodMonth_idx" ON "ProfitabilitySnapshot"("farmId", "periodYear", "periodMonth");

ALTER TABLE "FarmProfitabilitySettings" ADD CONSTRAINT "FarmProfitabilitySettings_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProfitabilitySnapshot" ADD CONSTRAINT "ProfitabilitySnapshot_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
