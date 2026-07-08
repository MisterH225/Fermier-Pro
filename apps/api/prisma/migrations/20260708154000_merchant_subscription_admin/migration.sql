-- AlterEnum MerchantSubscriptionStatus
ALTER TYPE "MerchantSubscriptionStatus" ADD VALUE IF NOT EXISTS 'suspended';
ALTER TYPE "MerchantSubscriptionStatus" ADD VALUE IF NOT EXISTS 'cancelled';
ALTER TYPE "MerchantSubscriptionStatus" ADD VALUE IF NOT EXISTS 'trialing';

-- CreateEnum MerchantPremiumBillingUnit
DO $$ BEGIN
  CREATE TYPE "MerchantPremiumBillingUnit" AS ENUM ('hour', 'day', 'month');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- PlatformSettings billing / trial / promo
ALTER TABLE "PlatformSettings"
  ADD COLUMN IF NOT EXISTS "merchantPremiumBillingUnit" "MerchantPremiumBillingUnit" NOT NULL DEFAULT 'month',
  ADD COLUMN IF NOT EXISTS "merchantPremiumBillingInterval" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "merchantPremiumGraceDays" INTEGER NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS "merchantPremiumTrialEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "merchantPremiumTrialUnits" INTEGER NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS "merchantPremiumPromoEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "merchantPremiumPromoPercentOff" INTEGER NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS "merchantPremiumPromoEndsAt" TIMESTAMP(3);

-- MerchantProfile admin subscription fields
ALTER TABLE "MerchantProfile"
  ADD COLUMN IF NOT EXISTS "trialEndsAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "promoPercentOffApplied" INTEGER,
  ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "suspendedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "suspensionReason" TEXT;

CREATE INDEX IF NOT EXISTS "MerchantProfile_subscriptionStatus_idx"
  ON "MerchantProfile"("subscriptionStatus");
