-- AlterTable — no-op if FarmAlertSettings absent (preview without Prisma baseline).
DO $$ BEGIN
  IF to_regclass('public."FarmAlertSettings"') IS NOT NULL THEN
    ALTER TABLE "FarmAlertSettings"
      ADD COLUMN IF NOT EXISTS "pushMarket" BOOLEAN NOT NULL DEFAULT true;
  END IF;
END $$;
