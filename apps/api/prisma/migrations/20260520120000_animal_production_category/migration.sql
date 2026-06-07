-- Catégorie métier par animal + compteurs de nomenclature par ferme
CREATE TYPE "AnimalProductionCategory" AS ENUM (
  'breeding_female',
  'breeding_male',
  'fattening',
  'starter',
  'unknown'
);

ALTER TABLE "Animal"
  ADD COLUMN "productionCategory" "AnimalProductionCategory" NOT NULL DEFAULT 'unknown';

ALTER TABLE "Farm"
  ADD COLUMN "lastTruiTagNumber" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastVerTagNumber" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastEngTagNumber" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastDemTagNumber" INTEGER NOT NULL DEFAULT 0;
