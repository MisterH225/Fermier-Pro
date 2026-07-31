-- Profils de besoins nutritionnels par stade (formulation feed_composition)

CREATE TYPE "ProductionStage" AS ENUM (
  'piglet_weaning',
  'growing',
  'fattening',
  'finishing',
  'gestating_sow',
  'lactating_sow'
);

CREATE TABLE "FeedRequirementProfile" (
    "id" TEXT NOT NULL,
    "stage" "ProductionStage" NOT NULL,
    "minCrudeProteinPct" DECIMAL(8,4) NOT NULL,
    "maxCrudeProteinPct" DECIMAL(8,4),
    "minMetabolizableEnergyKcal" DECIMAL(12,2) NOT NULL,
    "maxMetabolizableEnergyKcal" DECIMAL(12,2),
    "minLysinePct" DECIMAL(8,4) NOT NULL,
    "minMethioninePct" DECIMAL(8,4) NOT NULL,
    "minCalciumPct" DECIMAL(8,4) NOT NULL,
    "maxCalciumPct" DECIMAL(8,4),
    "minPhosphorusPct" DECIMAL(8,4) NOT NULL,
    "maxFiberPct" DECIMAL(8,4),
    "minLysinePerMcal" DECIMAL(8,4),
    "targetDailyIntakeKg" DECIMAL(8,3),
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeedRequirementProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FeedRequirementProfile_stage_key" ON "FeedRequirementProfile"("stage");
CREATE INDEX "FeedRequirementProfile_isActive_idx" ON "FeedRequirementProfile"("isActive");
