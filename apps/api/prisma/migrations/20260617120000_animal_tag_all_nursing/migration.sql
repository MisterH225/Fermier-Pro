-- Préfixe All (allaitement) + catégorie production nursing
ALTER TYPE "AnimalProductionCategory" ADD VALUE IF NOT EXISTS 'nursing';

ALTER TABLE "Farm" ADD COLUMN IF NOT EXISTS "lastAllTagNumber" INTEGER NOT NULL DEFAULT 0;
