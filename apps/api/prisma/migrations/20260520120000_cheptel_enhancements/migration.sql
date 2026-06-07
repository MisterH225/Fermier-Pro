-- Cheptel : champs animal + paramètres GMQ par ferme
CREATE TYPE "AnimalOrigin" AS ENUM ('farm_born', 'purchased');

ALTER TABLE "Animal"
  ADD COLUMN IF NOT EXISTS "photoUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "origin" "AnimalOrigin",
  ADD COLUMN IF NOT EXISTS "supplier" TEXT,
  ADD COLUMN IF NOT EXISTS "entryWeightKg" DECIMAL(10,3),
  ADD COLUMN IF NOT EXISTS "statusChangedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "FarmGmqSettings" (
  "id" TEXT NOT NULL,
  "farmId" TEXT NOT NULL,
  "categoryKey" TEXT NOT NULL,
  "targetGmqGPerDay" DECIMAL(8,2),
  "targetSaleWeightKg" DECIMAL(10,3),
  "alertThresholdGmq" DECIMAL(8,2),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "FarmGmqSettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FarmGmqSettings_farmId_categoryKey_key"
  ON "FarmGmqSettings"("farmId", "categoryKey");

CREATE INDEX IF NOT EXISTS "FarmGmqSettings_farmId_idx"
  ON "FarmGmqSettings"("farmId");

ALTER TABLE "FarmGmqSettings"
  ADD CONSTRAINT "FarmGmqSettings_farmId_fkey"
  FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
