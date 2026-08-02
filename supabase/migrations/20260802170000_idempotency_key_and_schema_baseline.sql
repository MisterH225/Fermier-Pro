-- Miroir Prisma 20260802170000_idempotency_key_and_schema_baseline
-- Idempotent : IdempotencyKey déjà présent en prod.

CREATE TABLE IF NOT EXISTS "IdempotencyKey" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "method" TEXT NOT NULL,
  "path" TEXT NOT NULL,
  "statusCode" INTEGER NOT NULL DEFAULT 0,
  "responseBody" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "IdempotencyKey_key_key" ON "IdempotencyKey"("key");
CREATE INDEX IF NOT EXISTS "IdempotencyKey_userId_createdAt_idx" ON "IdempotencyKey"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "IdempotencyKey_expiresAt_idx" ON "IdempotencyKey"("expiresAt");

DO $$ BEGIN
  REVOKE ALL ON TABLE "IdempotencyKey" FROM anon, authenticated;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;
ALTER TABLE "IdempotencyKey" ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  ALTER TABLE "MerchantSubscriptionPromoCode" ALTER COLUMN "updatedAt" DROP DEFAULT;
EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "ProducerSubscriptionInvoice" ALTER COLUMN "updatedAt" DROP DEFAULT;
EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'MerchantSubscriptionInvoice_merchantProfileId_billingPeriodStar'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'MerchantSubscriptionInvoice_merchantProfileId_billingPeriod_key'
  ) THEN
    ALTER INDEX "MerchantSubscriptionInvoice_merchantProfileId_billingPeriodStar"
      RENAME TO "MerchantSubscriptionInvoice_merchantProfileId_billingPeriod_key";
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'MerchantSubscriptionPromoRedemption_promoCodeId_merchantProfile'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'MerchantSubscriptionPromoRedemption_promoCodeId_merchantPro_key'
  ) THEN
    ALTER INDEX "MerchantSubscriptionPromoRedemption_promoCodeId_merchantProfile"
      RENAME TO "MerchantSubscriptionPromoRedemption_promoCodeId_merchantPro_key";
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'MillIngredientOffer_millProfileId_feedIngredientId_packaging_ke'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'MillIngredientOffer_millProfileId_feedIngredientId_packagin_key'
  ) THEN
    ALTER INDEX "MillIngredientOffer_millProfileId_feedIngredientId_packaging_ke"
      RENAME TO "MillIngredientOffer_millProfileId_feedIngredientId_packagin_key";
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'ProducerSubscriptionInvoice_producerProfileId_billingPeriodStar'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'ProducerSubscriptionInvoice_producerProfileId_billingPeriod_key'
  ) THEN
    ALTER INDEX "ProducerSubscriptionInvoice_producerProfileId_billingPeriodStar"
      RENAME TO "ProducerSubscriptionInvoice_producerProfileId_billingPeriod_key";
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'TechnicianRating_technicianUserId_ratedByUserId_farmId_periodYe'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'TechnicianRating_technicianUserId_ratedByUserId_farmId_peri_key'
  ) THEN
    ALTER INDEX "TechnicianRating_technicianUserId_ratedByUserId_farmId_periodYe"
      RENAME TO "TechnicianRating_technicianUserId_ratedByUserId_farmId_peri_key";
  END IF;
END $$;
