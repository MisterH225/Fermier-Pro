-- Abonnement Premium commerçant : cycle mensuel, factures et grâce 7 jours

DO $$ BEGIN
  CREATE TYPE "MerchantSubscriptionStatus" AS ENUM ('active', 'past_due');
EXCEPTION WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE "MerchantSubscriptionInvoiceStatus" AS ENUM ('pending', 'paid', 'failed', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE "MerchantSubscriptionReminderStage" AS ENUM ('none', 'j_minus_3', 'j0', 'j_plus_3', 'j_plus_7');
EXCEPTION WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "MerchantProfile"
  ADD COLUMN IF NOT EXISTS "subscriptionStatus" "MerchantSubscriptionStatus",
  ADD COLUMN IF NOT EXISTS "nextBillingAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "graceEndsAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "billingReminderKey" TEXT;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
CREATE TABLE IF NOT EXISTS "MerchantSubscriptionInvoice" (
  "id" TEXT NOT NULL,
  "merchantProfileId" TEXT NOT NULL,
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
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MerchantSubscriptionInvoice_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "MerchantSubscriptionInvoice_merchantProfileId_billingPeriodStart_key"
  ON "MerchantSubscriptionInvoice"("merchantProfileId", "billingPeriodStart");
EXCEPTION WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "MerchantSubscriptionInvoice_status_dueDate_idx"
  ON "MerchantSubscriptionInvoice"("status", "dueDate");
EXCEPTION WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "MerchantSubscriptionInvoice_merchantProfileId_status_idx"
  ON "MerchantSubscriptionInvoice"("merchantProfileId", "status");
EXCEPTION WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "MerchantProfile_subscriptionTier_nextBillingAt_idx"
  ON "MerchantProfile"("subscriptionTier", "nextBillingAt");
EXCEPTION WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "MerchantSubscriptionInvoice" ADD CONSTRAINT "MerchantSubscriptionInvoice_merchantProfileId_fkey"
    FOREIGN KEY ("merchantProfileId") REFERENCES "MerchantProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  UPDATE "MerchantProfile"
SET
  "nextBillingAt" = "premiumPaidAt" + interval '1 month',
  "subscriptionStatus" = 'active'
WHERE "subscriptionTier" = 'premium'
  AND "premiumPaidAt" IS NOT NULL
  AND "nextBillingAt" IS NULL;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;