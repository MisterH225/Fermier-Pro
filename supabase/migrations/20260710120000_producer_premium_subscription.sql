-- Miroir Prisma 20260710120000_producer_premium_subscription

-- Prisma 20260708154000_merchant_subscription_admin (non mirroir sous supabase/).
DO $$ BEGIN
  CREATE TYPE "MerchantPremiumBillingUnit" AS ENUM ('hour', 'day', 'month');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ProducerProfile" ADD COLUMN IF NOT EXISTS "subscriptionTier" "MerchantSubscriptionTier";
EXCEPTION WHEN undefined_table THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "ProducerProfile" ADD COLUMN IF NOT EXISTS "subscriptionStatus" "MerchantSubscriptionStatus";
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "ProducerProfile" ADD COLUMN IF NOT EXISTS "subscriptionChosenAt" TIMESTAMP(3);
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "ProducerProfile" ADD COLUMN IF NOT EXISTS "premiumPaidAt" TIMESTAMP(3);
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "ProducerProfile" ADD COLUMN IF NOT EXISTS "nextBillingAt" TIMESTAMP(3);
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "ProducerProfile" ADD COLUMN IF NOT EXISTS "graceEndsAt" TIMESTAMP(3);
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "ProducerProfile" ADD COLUMN IF NOT EXISTS "billingReminderKey" TEXT;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "ProducerProfile" ADD COLUMN IF NOT EXISTS "trialEndsAt" TIMESTAMP(3);
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "ProducerProfile" ADD COLUMN IF NOT EXISTS "promoPercentOffApplied" INTEGER;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "ProducerProfile" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3);
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "ProducerProfile" ADD COLUMN IF NOT EXISTS "suspendedAt" TIMESTAMP(3);
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "ProducerProfile" ADD COLUMN IF NOT EXISTS "suspensionReason" TEXT;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "ProducerProfile_subscriptionTier_idx" ON "ProducerProfile"("subscriptionTier");
EXCEPTION WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "ProducerProfile_subscriptionTier_nextBillingAt_idx" ON "ProducerProfile"("subscriptionTier", "nextBillingAt");
EXCEPTION WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "ProducerProfile_subscriptionStatus_idx" ON "ProducerProfile"("subscriptionStatus");
EXCEPTION WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "producerPremiumPriceXof" DECIMAL(14,2) NOT NULL DEFAULT 5000;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "producerPremiumBillingUnit" "MerchantPremiumBillingUnit" NOT NULL DEFAULT 'month';
EXCEPTION WHEN undefined_table THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "producerPremiumBillingInterval" INTEGER NOT NULL DEFAULT 1;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "producerPremiumGraceDays" INTEGER NOT NULL DEFAULT 7;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "producerPremiumTrialEnabled" BOOLEAN NOT NULL DEFAULT false;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "producerPremiumTrialUnits" INTEGER NOT NULL DEFAULT 7;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "producerPremiumPromoEnabled" BOOLEAN NOT NULL DEFAULT false;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "producerPremiumPromoPercentOff" INTEGER NOT NULL DEFAULT 20;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "producerPremiumPromoEndsAt" TIMESTAMP(3);
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
CREATE TABLE IF NOT EXISTS "ProducerSubscriptionInvoice" (
  "id" TEXT NOT NULL,
  "producerProfileId" TEXT NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'XOF',
  "status" "MerchantSubscriptionInvoiceStatus" NOT NULL DEFAULT 'pending',
  "providerRef" TEXT,
  "paymentUrl" TEXT,
  "billingPeriodStart" TIMESTAMP(3) NOT NULL,
  "billingPeriodEnd" TIMESTAMP(3) NOT NULL,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "paidAt" TIMESTAMP(3),
  "reminderStage" "MerchantSubscriptionReminderStage" NOT NULL DEFAULT 'none',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProducerSubscriptionInvoice_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "ProducerSubscriptionInvoice_producerProfileId_billingPeriodStart_key"
  ON "ProducerSubscriptionInvoice"("producerProfileId", "billingPeriodStart");
EXCEPTION WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "ProducerSubscriptionInvoice_status_dueDate_idx"
  ON "ProducerSubscriptionInvoice"("status", "dueDate");
EXCEPTION WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "ProducerSubscriptionInvoice_producerProfileId_status_idx"
  ON "ProducerSubscriptionInvoice"("producerProfileId", "status");
EXCEPTION WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "ProducerSubscriptionInvoice" ADD CONSTRAINT "ProducerSubscriptionInvoice_producerProfileId_fkey"
    FOREIGN KEY ("producerProfileId") REFERENCES "ProducerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

-- Backfill soft uniquement : ne pas supprimer les memberships ni expirer les invitations.
DO $$ BEGIN
  UPDATE "ProducerProfile"
SET "subscriptionTier" = COALESCE("subscriptionTier", 'free'),
    "subscriptionChosenAt" = COALESCE("subscriptionChosenAt", NOW())
WHERE "subscriptionTier" IS NULL;
EXCEPTION WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;