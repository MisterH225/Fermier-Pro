-- Phase aliment + lien animal → bande (bandes préexistantes confirmées)

ALTER TYPE "FeedProductionPhase" ADD VALUE IF NOT EXISTS 'sous_mere';
ALTER TYPE "FeedProductionPhase" ADD VALUE IF NOT EXISTS 'transition';

ALTER TABLE "FeedType"
ADD COLUMN IF NOT EXISTS "productionPhase" "FeedProductionPhase" NOT NULL DEFAULT 'unknown';

ALTER TABLE "Animal" ADD COLUMN IF NOT EXISTS "livestockBatchId" TEXT;

CREATE INDEX IF NOT EXISTS "Animal_livestockBatchId_idx" ON "Animal"("livestockBatchId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Animal_livestockBatchId_fkey'
  ) THEN
    ALTER TABLE "Animal"
    ADD CONSTRAINT "Animal_livestockBatchId_fkey"
    FOREIGN KEY ("livestockBatchId") REFERENCES "LivestockBatch"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
