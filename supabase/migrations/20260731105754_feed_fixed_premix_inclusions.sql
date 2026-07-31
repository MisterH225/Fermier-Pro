-- Synced to match remote supabase_migrations.schema_migrations version.
-- Required for Supabase Preview / branching history reconciliation.

-- Source mirrored from apps/api/prisma/migrations

-- AlterTable FeedIngredient : marque additifs à taux fixe (CMV, sel…)
ALTER TABLE "FeedIngredient" ADD COLUMN "isPremix" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable FeedRequirementProfile : taux d'incorporation fixes par stade
ALTER TABLE "FeedRequirementProfile" ADD COLUMN "fixedInclusions" JSONB NOT NULL DEFAULT '[]';

CREATE INDEX "FeedIngredient_isPremix_isActive_idx" ON "FeedIngredient"("isPremix", "isActive");
