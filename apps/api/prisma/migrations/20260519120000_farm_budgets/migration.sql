-- Budget mensuel par catégorie de dépense

CREATE TYPE "BudgetStatus" AS ENUM ('on_track', 'warning', 'exceeded');
CREATE TYPE "BudgetCreatedFrom" AS ENUM ('manual', 'copied', 'auto_suggested');
CREATE TYPE "BudgetLineStatus" AS ENUM ('ok', 'warning', 'exceeded');

CREATE TABLE "FarmBudget" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "totalPlanned" DECIMAL(14,2) NOT NULL,
    "status" "BudgetStatus" NOT NULL DEFAULT 'on_track',
    "createdFrom" "BudgetCreatedFrom" NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FarmBudget_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FarmBudgetLine" (
    "id" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "amountPlanned" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "FarmBudgetLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FarmBudgetSuggestion" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "budgetId" TEXT,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "actionPayload" JSONB,
    "isApplied" BOOLEAN NOT NULL DEFAULT false,
    "isDismissed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FarmBudgetSuggestion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FarmBudget_farmId_year_month_key" ON "FarmBudget"("farmId", "year", "month");
CREATE INDEX "FarmBudget_farmId_year_month_idx" ON "FarmBudget"("farmId", "year", "month");

CREATE UNIQUE INDEX "FarmBudgetLine_budgetId_categoryId_key" ON "FarmBudgetLine"("budgetId", "categoryId");
CREATE INDEX "FarmBudgetLine_categoryId_idx" ON "FarmBudgetLine"("categoryId");

CREATE INDEX "FarmBudgetSuggestion_farmId_budgetId_idx" ON "FarmBudgetSuggestion"("farmId", "budgetId");
CREATE INDEX "FarmBudgetSuggestion_farmId_isDismissed_isApplied_idx" ON "FarmBudgetSuggestion"("farmId", "isDismissed", "isApplied");

ALTER TABLE "FarmBudget" ADD CONSTRAINT "FarmBudget_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FarmBudgetLine" ADD CONSTRAINT "FarmBudgetLine_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "FarmBudget"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FarmBudgetLine" ADD CONSTRAINT "FarmBudgetLine_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FinanceCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FarmBudgetSuggestion" ADD CONSTRAINT "FarmBudgetSuggestion_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FarmBudgetSuggestion" ADD CONSTRAINT "FarmBudgetSuggestion_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "FarmBudget"("id") ON DELETE CASCADE ON UPDATE CASCADE;
