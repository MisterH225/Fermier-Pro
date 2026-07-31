-- Référentiel partagé des intrants d'aliment (moulins + formulation)

CREATE TYPE "FeedIngredientCategory" AS ENUM (
  'cereal',
  'plant_protein',
  'animal_protein',
  'byproduct',
  'mineral',
  'additive'
);

CREATE TABLE "FeedIngredient" (
    "id" TEXT NOT NULL,
    "canonicalName" TEXT NOT NULL,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "category" "FeedIngredientCategory" NOT NULL,
    "crudeProteinPct" DECIMAL(8,4) NOT NULL,
    "metabolizableEnergyKcal" DECIMAL(12,2) NOT NULL,
    "lysinePct" DECIMAL(8,4) NOT NULL,
    "methioninePct" DECIMAL(8,4) NOT NULL,
    "calciumPct" DECIMAL(8,4) NOT NULL,
    "phosphorusPct" DECIMAL(8,4) NOT NULL,
    "crudeFiberPct" DECIMAL(8,4) NOT NULL,
    "fatPct" DECIMAL(8,4) NOT NULL,
    "dryMatterPct" DECIMAL(8,4) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeedIngredient_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FeedIngredient_canonicalName_key" ON "FeedIngredient"("canonicalName");
CREATE INDEX "FeedIngredient_category_isActive_idx" ON "FeedIngredient"("category", "isActive");
