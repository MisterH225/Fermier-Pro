-- Platform feature flags (mirrors Prisma migration 20260530120000)

DO $$ BEGIN
  CREATE TYPE "FeatureFlagHistoryAction" AS ENUM ('disabled', 'reactivated', 'scheduled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Ensure base enum exists on preview DBs (Prisma baseline may be absent).
DO $$ BEGIN
  CREATE TYPE "SmartAlertModule" AS ENUM (
    'stock',
    'health',
    'finance',
    'gestation',
    'cheptel'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE "SmartAlertModule" ADD VALUE IF NOT EXISTS 'market';

-- Optional columns on Prisma-baseline tables (absent on cold preview replay).
DO $$ BEGIN
  ALTER TABLE "FarmTask" ADD COLUMN IF NOT EXISTS "archived" BOOLEAN NOT NULL DEFAULT false;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "MarketplaceListing" ADD COLUMN IF NOT EXISTS "archived" BOOLEAN NOT NULL DEFAULT false;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "MarketplaceOffer" ADD COLUMN IF NOT EXISTS "archived" BOOLEAN NOT NULL DEFAULT false;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "FarmInvitation" ADD COLUMN IF NOT EXISTS "archived" BOOLEAN NOT NULL DEFAULT false;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "FarmMembership" ADD COLUMN IF NOT EXISTS "archived" BOOLEAN NOT NULL DEFAULT false;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "Gestation" ADD COLUMN IF NOT EXISTS "archived" BOOLEAN NOT NULL DEFAULT false;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "PlatformFeatureFlag" (
    "moduleId" TEXT NOT NULL,
    "moduleName" TEXT NOT NULL,
    "icon" TEXT,
    "canDisable" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "disabledAt" TIMESTAMP(3),
    "disabledById" TEXT,
    "disableReason" TEXT,
    "reactivatedAt" TIMESTAMP(3),
    "reactivatedById" TEXT,
    "scheduledReactivation" TIMESTAMP(3),
    "userMessageFr" TEXT,
    "userMessageEn" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlatformFeatureFlag_pkey" PRIMARY KEY ("moduleId")
);

CREATE TABLE IF NOT EXISTS "FeatureFlagHistory" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "action" "FeatureFlagHistoryAction" NOT NULL,
    "performedById" TEXT,
    "reason" TEXT,
    "affectedDataSummary" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FeatureFlagHistory_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "FeatureFlagHistory_moduleId_createdAt_idx"
  ON "FeatureFlagHistory"("moduleId", "createdAt" DESC);
EXCEPTION WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;
CREATE TABLE IF NOT EXISTS "ArchivedDataRegistry" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "tableName" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "originalStatus" TEXT,
    "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "restoredAt" TIMESTAMP(3),
    CONSTRAINT "ArchivedDataRegistry_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "ArchivedDataRegistry_moduleId_restoredAt_idx"
  ON "ArchivedDataRegistry"("moduleId", "restoredAt");
EXCEPTION WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;
CREATE TABLE IF NOT EXISTS "ReactivationWaitlist" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReactivationWaitlist_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "ReactivationWaitlist_moduleId_userId_key"
  ON "ReactivationWaitlist"("moduleId", "userId");
EXCEPTION WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;
DO $$ BEGIN
  IF to_regclass('public."User"') IS NOT NULL THEN
    ALTER TABLE "ReactivationWaitlist" DROP CONSTRAINT IF EXISTS "ReactivationWaitlist_userId_fkey";
    ALTER TABLE "ReactivationWaitlist" ADD CONSTRAINT "ReactivationWaitlist_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  ALTER TABLE "BuyerPriceAlert" ADD COLUMN IF NOT EXISTS "archived" BOOLEAN NOT NULL DEFAULT false;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  INSERT INTO "PlatformFeatureFlag" ("moduleId", "moduleName", "icon", "canDisable", "isActive", "updatedAt")
VALUES
  ('core_producer', 'Producteur', '🏡', false, true, CURRENT_TIMESTAMP),
  ('technician', 'Technicien / Porcher', '🔧', true, true, CURRENT_TIMESTAMP),
  ('veterinarian', 'Vétérinaire', '👨‍⚕️', true, true, CURRENT_TIMESTAMP),
  ('marketplace', 'Marketplace', '🛒', true, true, CURRENT_TIMESTAMP),
  ('buyer', 'Acheteur', '🛒', true, true, CURRENT_TIMESTAMP),
  ('collaboration', 'Collaboration', '🤝', true, true, CURRENT_TIMESTAMP),
  ('reports', 'Rapports', '📋', true, true, CURRENT_TIMESTAMP),
  ('ai_assistant', 'Assistant IA', '🤖', true, true, CURRENT_TIMESTAMP),
  ('pig_price_index', 'PigPrice Index', '📊', true, true, CURRENT_TIMESTAMP),
  ('gestation', 'Gestation', '🐣', true, true, CURRENT_TIMESTAMP),
  ('nutrition', 'Nutrition', '🌾', true, true, CURRENT_TIMESTAMP)
ON CONFLICT ("moduleId") DO NOTHING;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;