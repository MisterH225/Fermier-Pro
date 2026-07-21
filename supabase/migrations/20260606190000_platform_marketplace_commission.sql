DO $$ BEGIN
  ALTER TABLE "PlatformSettings"
  ADD COLUMN IF NOT EXISTS "marketplaceCommissionRate" DECIMAL(5,4) NOT NULL DEFAULT 0.05;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
DO $$ BEGIN
  UPDATE "PlatformSettings"
SET "marketplaceCommissionRate" = 0.05
WHERE "marketplaceCommissionRate" IS NULL;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;