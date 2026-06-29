-- CreateEnum
CREATE TYPE "HistoricalMovementType" AS ENUM ('income', 'expense');

-- CreateEnum
CREATE TYPE "HistoricalEntryMode" AS ENUM ('quick_total', 'import');

-- CreateEnum
CREATE TYPE "HistoricalCategory" AS ENUM (
  'achat_animaux',
  'aliments',
  'infrastructure',
  'sante_veterinaire',
  'main_oeuvre',
  'transport',
  'equipement',
  'autres_depenses',
  'vente_animaux',
  'vente_produits_derives',
  'subventions',
  'autres_revenus'
);

-- CreateTable
CREATE TABLE "HistoricalRecord" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "movementType" "HistoricalMovementType" NOT NULL,
    "category" "HistoricalCategory" NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "entryMode" "HistoricalEntryMode" NOT NULL,
    "periodStart" DATE,
    "periodEnd" DATE NOT NULL,
    "transactionDate" DATE,
    "description" TEXT,
    "importBatchId" TEXT,
    "sourceFilename" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HistoricalRecord_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "HistoricalRecord_amount_positive" CHECK ("amount" > 0)
);

-- CreateIndex
CREATE INDEX "HistoricalRecord_farmId_idx" ON "HistoricalRecord"("farmId");

-- CreateIndex
CREATE INDEX "HistoricalRecord_movementType_idx" ON "HistoricalRecord"("movementType");

-- CreateIndex
CREATE INDEX "HistoricalRecord_category_idx" ON "HistoricalRecord"("category");

-- CreateIndex
CREATE INDEX "HistoricalRecord_importBatchId_idx" ON "HistoricalRecord"("importBatchId");

-- CreateIndex
CREATE INDEX "HistoricalRecord_periodEnd_idx" ON "HistoricalRecord"("periodEnd");

-- AddForeignKey
ALTER TABLE "HistoricalRecord" ADD CONSTRAINT "HistoricalRecord_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
