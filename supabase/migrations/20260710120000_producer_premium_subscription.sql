-- Miroir Prisma 20260710120000_producer_premium_subscription

ALTER TABLE "ProducerProfile" ADD COLUMN IF NOT EXISTS "subscriptionTier" "MerchantSubscriptionTier";
ALTER TABLE "ProducerProfile" ADD COLUMN IF NOT EXISTS "subscriptionStatus" "MerchantSubscriptionStatus";
ALTER TABLE "ProducerProfile" ADD COLUMN IF NOT EXISTS "subscriptionChosenAt" TIMESTAMP(3);
ALTER TABLE "ProducerProfile" ADD COLUMN IF NOT EXISTS "premiumPaidAt" TIMESTAMP(3);
ALTER TABLE "ProducerProfile" ADD COLUMN IF NOT EXISTS "nextBillingAt" TIMESTAMP(3);
ALTER TABLE "ProducerProfile" ADD COLUMN IF NOT EXISTS "graceEndsAt" TIMESTAMP(3);
ALTER TABLE "ProducerProfile" ADD COLUMN IF NOT EXISTS "billingReminderKey" TEXT;
ALTER TABLE "ProducerProfile" ADD COLUMN IF NOT EXISTS "trialEndsAt" TIMESTAMP(3);
ALTER TABLE "ProducerProfile" ADD COLUMN IF NOT EXISTS "promoPercentOffApplied" INTEGER;
ALTER TABLE "ProducerProfile" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3);
ALTER TABLE "ProducerProfile" ADD COLUMN IF NOT EXISTS "suspendedAt" TIMESTAMP(3);
ALTER TABLE "ProducerProfile" ADD COLUMN IF NOT EXISTS "suspensionReason" TEXT;

CREATE INDEX IF NOT EXISTS "ProducerProfile_subscriptionTier_idx" ON "ProducerProfile"("subscriptionTier");
CREATE INDEX IF NOT EXISTS "ProducerProfile_subscriptionTier_nextBillingAt_idx" ON "ProducerProfile"("subscriptionTier", "nextBillingAt");
CREATE INDEX IF NOT EXISTS "ProducerProfile_subscriptionStatus_idx" ON "ProducerProfile"("subscriptionStatus");

ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "producerPremiumPriceXof" DECIMAL(14,2) NOT NULL DEFAULT 5000;
ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "producerPremiumBillingUnit" "MerchantPremiumBillingUnit" NOT NULL DEFAULT 'month';
ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "producerPremiumBillingInterval" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "producerPremiumGraceDays" INTEGER NOT NULL DEFAULT 7;
ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "producerPremiumTrialEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "producerPremiumTrialUnits" INTEGER NOT NULL DEFAULT 7;
ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "producerPremiumPromoEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "producerPremiumPromoPercentOff" INTEGER NOT NULL DEFAULT 20;
ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "producerPremiumPromoEndsAt" TIMESTAMP(3);

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

CREATE UNIQUE INDEX IF NOT EXISTS "ProducerSubscriptionInvoice_producerProfileId_billingPeriodStart_key"
  ON "ProducerSubscriptionInvoice"("producerProfileId", "billingPeriodStart");
CREATE INDEX IF NOT EXISTS "ProducerSubscriptionInvoice_status_dueDate_idx"
  ON "ProducerSubscriptionInvoice"("status", "dueDate");
CREATE INDEX IF NOT EXISTS "ProducerSubscriptionInvoice_producerProfileId_status_idx"
  ON "ProducerSubscriptionInvoice"("producerProfileId", "status");

DO $$ BEGIN
  ALTER TABLE "ProducerSubscriptionInvoice" ADD CONSTRAINT "ProducerSubscriptionInvoice_producerProfileId_fkey"
    FOREIGN KEY ("producerProfileId") REFERENCES "ProducerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

UPDATE "ProducerProfile"
SET "subscriptionTier" = 'free',
    "subscriptionStatus" = NULL,
    "subscriptionChosenAt" = COALESCE("subscriptionChosenAt", NOW());

DELETE FROM "FarmMembership" WHERE "role" <> 'owner';

UPDATE "FarmInvitation"
SET "status" = 'expired'
WHERE "status" IN ('pending', 'accepted');
