-- Synced to match remote supabase_migrations.schema_migrations version.
-- Required for Supabase Preview / branching history reconciliation.

-- Source mirrored from apps/api/prisma/migrations

-- Liaison bidirectionnelle Finance (FarmExpense) ↔ Stock (FeedStockMovement)
ALTER TABLE "FarmExpense" ADD COLUMN "linkedStockMovementIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

CREATE INDEX "FarmExpense_linkedStockMovementIds_idx" ON "FarmExpense" USING GIN ("linkedStockMovementIds");
CREATE INDEX "FeedStockMovement_linkedExpenseId_idx" ON "FeedStockMovement"("linkedExpenseId");
