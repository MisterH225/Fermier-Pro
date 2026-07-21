-- Mirror of apps/api/prisma/migrations/20260721020000_farm_expense_source_auto/migration.sql
-- Source des dépenses (manual | auto) pour bloquer l'édition des écritures plateforme.
-- Guard: FarmExpense may be absent on preview DBs that only replay supabase/migrations.
DO $$ BEGIN
  IF to_regclass('public."FarmExpense"') IS NOT NULL THEN
    ALTER TABLE "FarmExpense"
      ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'manual';
    CREATE INDEX IF NOT EXISTS "FarmExpense_linkedEntityType_linkedEntityId_idx"
      ON "FarmExpense"("linkedEntityType", "linkedEntityId");
  END IF;
END $$;
