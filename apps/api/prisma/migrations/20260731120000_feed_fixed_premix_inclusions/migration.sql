-- AlterTable FeedIngredient : marque additifs à taux fixe (CMV, sel…)
ALTER TABLE "FeedIngredient" ADD COLUMN "isPremix" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable FeedRequirementProfile : taux d'incorporation fixes par stade
ALTER TABLE "FeedRequirementProfile" ADD COLUMN "fixedInclusions" JSONB NOT NULL DEFAULT '[]';

CREATE INDEX "FeedIngredient_isPremix_isActive_idx" ON "FeedIngredient"("isPremix", "isActive");
