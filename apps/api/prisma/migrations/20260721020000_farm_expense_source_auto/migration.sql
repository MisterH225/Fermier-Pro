-- Source des dépenses (manual | auto) pour bloquer l'édition des écritures plateforme.
ALTER TABLE "FarmExpense"
  ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'manual';

CREATE INDEX IF NOT EXISTS "FarmExpense_linkedEntityType_linkedEntityId_idx"
  ON "FarmExpense"("linkedEntityType", "linkedEntityId");
