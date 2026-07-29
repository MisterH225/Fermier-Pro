-- Configurable subscription tier limits (null = unlimited)
ALTER TABLE "PlatformSettings"
  ADD COLUMN IF NOT EXISTS "producerStandardMaxFarms" INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "producerPremiumMaxFarms" INTEGER,
  ADD COLUMN IF NOT EXISTS "merchantStandardMaxShops" INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "merchantStandardMaxProductsPerShop" INTEGER DEFAULT 3,
  ADD COLUMN IF NOT EXISTS "merchantPremiumMaxProductsPerShop" INTEGER;

-- merchantPremiumMaxShops: Int -> Int? (null = unlimited); create if missing
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'PlatformSettings'
      AND column_name = 'merchantPremiumMaxShops'
  ) THEN
    ALTER TABLE "PlatformSettings" ALTER COLUMN "merchantPremiumMaxShops" DROP NOT NULL;
    ALTER TABLE "PlatformSettings" ALTER COLUMN "merchantPremiumMaxShops" SET DEFAULT 3;
  ELSE
    ALTER TABLE "PlatformSettings"
      ADD COLUMN "merchantPremiumMaxShops" INTEGER DEFAULT 3;
  END IF;
END $$;

-- Read-only demotion locks (no data deletion)
ALTER TABLE "Farm"
  ADD COLUMN IF NOT EXISTS "writeLockedAt" TIMESTAMP(3);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'MerchantShop'
  ) THEN
    ALTER TABLE "MerchantShop"
      ADD COLUMN IF NOT EXISTS "writeLockedAt" TIMESTAMP(3);
  END IF;
END $$;
