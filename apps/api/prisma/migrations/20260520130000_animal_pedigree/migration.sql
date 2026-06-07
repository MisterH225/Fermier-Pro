-- Filiation : truie (dam) et verrat (sire) pour sujets nés à la ferme
ALTER TABLE "Animal"
  ADD COLUMN IF NOT EXISTS "damId" TEXT,
  ADD COLUMN IF NOT EXISTS "sireId" TEXT;

CREATE INDEX IF NOT EXISTS "Animal_damId_idx" ON "Animal"("damId");
CREATE INDEX IF NOT EXISTS "Animal_sireId_idx" ON "Animal"("sireId");

ALTER TABLE "Animal"
  ADD CONSTRAINT "Animal_damId_fkey"
  FOREIGN KEY ("damId") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Animal"
  ADD CONSTRAINT "Animal_sireId_fkey"
  FOREIGN KEY ("sireId") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
