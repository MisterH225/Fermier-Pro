DO $$ BEGIN
  CREATE TYPE "MerchantSubscriptionPromoCodeType" AS ENUM ('trial', 'discount', 'promo');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "MerchantSubscriptionPromoCode" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "type" "MerchantSubscriptionPromoCodeType" NOT NULL,
  "label" TEXT,
  "percentOff" INTEGER,
  "trialUnits" INTEGER,
  "maxRedemptions" INTEGER,
  "redemptionCount" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MerchantSubscriptionPromoCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MerchantSubscriptionPromoCode_code_key"
  ON "MerchantSubscriptionPromoCode"("code");
CREATE INDEX IF NOT EXISTS "MerchantSubscriptionPromoCode_isActive_expiresAt_idx"
  ON "MerchantSubscriptionPromoCode"("isActive", "expiresAt");
CREATE INDEX IF NOT EXISTS "MerchantSubscriptionPromoCode_type_idx"
  ON "MerchantSubscriptionPromoCode"("type");

CREATE TABLE IF NOT EXISTS "MerchantSubscriptionPromoRedemption" (
  "id" TEXT NOT NULL,
  "promoCodeId" TEXT NOT NULL,
  "merchantProfileId" TEXT NOT NULL,
  "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MerchantSubscriptionPromoRedemption_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MerchantSubscriptionPromoRedemption_promoCodeId_merchantProfileId_key"
  ON "MerchantSubscriptionPromoRedemption"("promoCodeId", "merchantProfileId");
CREATE INDEX IF NOT EXISTS "MerchantSubscriptionPromoRedemption_merchantProfileId_idx"
  ON "MerchantSubscriptionPromoRedemption"("merchantProfileId");

DO $$ BEGIN
  ALTER TABLE "MerchantSubscriptionPromoRedemption" ADD CONSTRAINT "MerchantSubscriptionPromoRedemption_promoCodeId_fkey"
    FOREIGN KEY ("promoCodeId") REFERENCES "MerchantSubscriptionPromoCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "MerchantSubscriptionPromoRedemption" ADD CONSTRAINT "MerchantSubscriptionPromoRedemption_merchantProfileId_fkey"
    FOREIGN KEY ("merchantProfileId") REFERENCES "MerchantProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
