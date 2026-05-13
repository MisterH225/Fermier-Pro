-- Finance hub : paramètres ferme, catégories, liens dépenses/revenus.

CREATE TYPE "FinanceCategoryType" AS ENUM ('income', 'expense');

CREATE TABLE "FarmFinanceSettings" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "currencyCode" TEXT NOT NULL DEFAULT 'XOF',
    "currencySymbol" TEXT NOT NULL DEFAULT 'FCFA',
    "lowBalanceThreshold" DECIMAL(14,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FarmFinanceSettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FarmFinanceSettings_farmId_key" ON "FarmFinanceSettings"("farmId");

ALTER TABLE "FarmFinanceSettings" ADD CONSTRAINT "FarmFinanceSettings_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "FinanceCategory" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "type" "FinanceCategoryType" NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FinanceCategory_farmId_type_key_key" ON "FinanceCategory"("farmId", "type", "key");

CREATE INDEX "FinanceCategory_farmId_type_idx" ON "FinanceCategory"("farmId", "type");

ALTER TABLE "FinanceCategory" ADD CONSTRAINT "FinanceCategory_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FarmExpense" ADD COLUMN "financeCategoryId" TEXT,
ADD COLUMN "linkedEntityType" TEXT,
ADD COLUMN "linkedEntityId" TEXT,
ADD COLUMN "attachmentUrl" TEXT;

CREATE INDEX "FarmExpense_financeCategoryId_idx" ON "FarmExpense"("financeCategoryId");

ALTER TABLE "FarmExpense" ADD CONSTRAINT "FarmExpense_financeCategoryId_fkey" FOREIGN KEY ("financeCategoryId") REFERENCES "FinanceCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FarmRevenue" ADD COLUMN "financeCategoryId" TEXT,
ADD COLUMN "linkedEntityType" TEXT,
ADD COLUMN "linkedEntityId" TEXT,
ADD COLUMN "attachmentUrl" TEXT;

CREATE INDEX "FarmRevenue_financeCategoryId_idx" ON "FarmRevenue"("financeCategoryId");

ALTER TABLE "FarmRevenue" ADD CONSTRAINT "FarmRevenue_financeCategoryId_fkey" FOREIGN KEY ("financeCategoryId") REFERENCES "FinanceCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
