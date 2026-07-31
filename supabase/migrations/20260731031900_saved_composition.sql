-- Synced to match remote supabase_migrations.schema_migrations version.
-- Required for Supabase Preview / branching history reconciliation.

-- Source mirrored from apps/api/prisma/migrations

-- Compositions d'aliment sauvegardées (feed_composition J3)

CREATE TYPE "SavedCompositionSource" AS ENUM ('ai_assisted', 'manual');
CREATE TYPE "SavedCompositionStatus" AS ENUM ('draft', 'vet_review', 'validated');

CREATE TABLE "SavedComposition" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "stage" "ProductionStage" NOT NULL,
    "inputParams" JSONB NOT NULL,
    "ration" JSONB NOT NULL,
    "nutritionResult" JSONB,
    "totalCostXof" DECIMAL(14,2) NOT NULL,
    "source" "SavedCompositionSource" NOT NULL,
    "status" "SavedCompositionStatus" NOT NULL DEFAULT 'draft',
    "vetComment" TEXT,
    "vetReviewedBy" TEXT,
    "vetReviewedAt" TIMESTAMP(3),
    "millProfileId" TEXT,
    "isTheoretical" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedComposition_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SavedComposition_farmId_createdAt_idx" ON "SavedComposition"("farmId", "createdAt" DESC);
CREATE INDEX "SavedComposition_farmId_status_idx" ON "SavedComposition"("farmId", "status");
CREATE INDEX "SavedComposition_createdByUserId_idx" ON "SavedComposition"("createdByUserId");

ALTER TABLE "SavedComposition" ADD CONSTRAINT "SavedComposition_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
