-- Mirror of apps/api/prisma/migrations/20260721020000_farm_expense_source_auto/migration.sql
-- Source des dépenses (manual | auto) pour bloquer l'édition des écritures plateforme.
-- Guard: FarmExpense may be a minimal stub on cold Preview (no linkedEntity* columns).

DO $$ BEGIN
  ALTER TABLE "FarmExpense"
    ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'manual';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "FarmExpense_linkedEntityType_linkedEntityId_idx"
    ON "FarmExpense"("linkedEntityType", "linkedEntityId");
EXCEPTION WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;
