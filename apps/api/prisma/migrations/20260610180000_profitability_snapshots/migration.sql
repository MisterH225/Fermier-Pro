-- CreateEnum
CREATE TYPE "ProfitabilityBatchStatus" AS ENUM ('open', 'closed');

-- CreateTable
CREATE TABLE "FarmProfitabilitySnapshot" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "snapshotDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "grossMarginRealized" DECIMAL(16,2) NOT NULL,
    "grossMarginPct" DECIMAL(8,4),
    "netMarginRealized" DECIMAL(16,2) NOT NULL,
    "netMarginPct" DECIMAL(8,4),
    "costPerKgRealized" DECIMAL(14,4),
    "costPerKgProjected" DECIMAL(14,4),
    "roiRealized" DECIMAL(10,4),
    "roiProjected" DECIMAL(10,4),
    "breakevenPricePerKg" DECIMAL(14,4),
    "revenuesRealized" DECIMAL(16,2) NOT NULL,
    "revenuesProjected" DECIMAL(16,2),
    "costsDirectRealized" DECIMAL(16,2) NOT NULL,
    "costsIndirectRealized" DECIMAL(16,2) NOT NULL,
    "costsProjected" DECIMAL(16,2),
    "grossMarginProjected" DECIMAL(16,2),
    "netMarginProjected" DECIMAL(16,2),
    "kgProducedRealized" DECIMAL(14,4),
    "kgProjected" DECIMAL(14,4),
    "marketPricePerKg" DECIMAL(14,4),
    "dataQuality" TEXT NOT NULL DEFAULT 'insufficient',
    "detailJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FarmProfitabilitySnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BatchProfitabilitySnapshot" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "snapshotDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "ProfitabilityBatchStatus" NOT NULL DEFAULT 'open',
    "revenuesRealized" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "revenuesProjected" DECIMAL(16,2),
    "costsDirectRealized" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "costsIndirectRealized" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "costsProjected" DECIMAL(16,2),
    "grossMarginRealized" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "netMarginRealized" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "netMarginPctRealized" DECIMAL(8,4),
    "costPerKgRealized" DECIMAL(14,4),
    "costPerKgProjected" DECIMAL(14,4),
    "roiRealized" DECIMAL(10,4),
    "roiProjected" DECIMAL(10,4),
    "icActual" DECIMAL(8,4),
    "gmqActual" DECIMAL(10,2),
    "kgProducedRealized" DECIMAL(14,4),
    "kgProjected" DECIMAL(14,4),
    "breakevenPricePerKg" DECIMAL(14,4),
    "isProfitable" BOOLEAN,
    "dataQuality" TEXT NOT NULL DEFAULT 'insufficient',
    "detailJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BatchProfitabilitySnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FarmProfitabilitySnapshot_farmId_period_key" ON "FarmProfitabilitySnapshot"("farmId", "period");

-- CreateIndex
CREATE INDEX "FarmProfitabilitySnapshot_farmId_snapshotDate_idx" ON "FarmProfitabilitySnapshot"("farmId", "snapshotDate" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "BatchProfitabilitySnapshot_batchId_key" ON "BatchProfitabilitySnapshot"("batchId");

-- CreateIndex
CREATE INDEX "BatchProfitabilitySnapshot_farmId_snapshotDate_idx" ON "BatchProfitabilitySnapshot"("farmId", "snapshotDate" DESC);

-- AddForeignKey
ALTER TABLE "FarmProfitabilitySnapshot" ADD CONSTRAINT "FarmProfitabilitySnapshot_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchProfitabilitySnapshot" ADD CONSTRAINT "BatchProfitabilitySnapshot_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchProfitabilitySnapshot" ADD CONSTRAINT "BatchProfitabilitySnapshot_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "LivestockBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
