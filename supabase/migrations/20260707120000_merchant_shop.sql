DO $$ BEGIN
  CREATE TYPE "ProfileType" AS ENUM ('producer');
EXCEPTION WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

-- Merchant shop module (idempotent)

DO $$ BEGIN
  ALTER TYPE "ProfileType" ADD VALUE IF NOT EXISTS 'merchant';
EXCEPTION WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "MerchantSubscriptionTier" AS ENUM ('free', 'premium');
EXCEPTION WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "MerchantProductStatus" AS ENUM ('draft', 'published', 'disabled', 'moderated_removed');
EXCEPTION WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "MerchantProductDisabledReason" AS ENUM ('limit_free', 'downgrade', 'swap', 'moderation');
EXCEPTION WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "MerchantOrderStatus" AS ENUM ('payment_pending', 'paid', 'cancelled', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

-- Prisma 20260623120000_buyer_wallet (non mirroir sous supabase/) — requis par MerchantOrder.
DO $$ BEGIN
  CREATE TYPE "MarketplacePaymentMethod" AS ENUM ('mobile_money', 'wallet');
EXCEPTION WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PlatformSettings"
  ADD COLUMN IF NOT EXISTS "merchantPremiumPriceXof" DECIMAL(14,2) NOT NULL DEFAULT 5000,
  ADD COLUMN IF NOT EXISTS "merchantPremiumMaxShops" INTEGER NOT NULL DEFAULT 3;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
CREATE TABLE IF NOT EXISTS "MerchantProfile" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "subscriptionTier" "MerchantSubscriptionTier",
  "subscriptionChosenAt" TIMESTAMP(3),
  "premiumPaidAt" TIMESTAMP(3),
  "shopSkipped" BOOLEAN NOT NULL DEFAULT false,
  "productSkipped" BOOLEAN NOT NULL DEFAULT false,
  "onboardingComplete" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MerchantProfile_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "MerchantProfile_userId_key" ON "MerchantProfile"("userId");
EXCEPTION WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "MerchantProfile_subscriptionTier_idx" ON "MerchantProfile"("subscriptionTier");
EXCEPTION WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "MerchantProfile" ADD CONSTRAINT "MerchantProfile_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "MerchantShop" (
  "id" TEXT NOT NULL,
  "merchantProfileId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "locationLabel" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MerchantShop_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "MerchantShop_merchantProfileId_idx" ON "MerchantShop"("merchantProfileId");
EXCEPTION WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "MerchantShop" ADD CONSTRAINT "MerchantShop_merchantProfileId_fkey"
    FOREIGN KEY ("merchantProfileId") REFERENCES "MerchantProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "MerchantProductCategory" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MerchantProductCategory_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "MerchantProductCategory_slug_key" ON "MerchantProductCategory"("slug");
EXCEPTION WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "MerchantProductCategory_isActive_sortOrder_idx" ON "MerchantProductCategory"("isActive", "sortOrder");
EXCEPTION WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;
CREATE TABLE IF NOT EXISTS "MerchantProduct" (
  "id" TEXT NOT NULL,
  "shopId" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "price" DECIMAL(14,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'XOF',
  "photoUrls" JSONB NOT NULL DEFAULT '[]',
  "stock" INTEGER NOT NULL DEFAULT 0,
  "status" "MerchantProductStatus" NOT NULL DEFAULT 'draft',
  "publishedAt" TIMESTAMP(3),
  "disabledAt" TIMESTAMP(3),
  "disabledReason" "MerchantProductDisabledReason",
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MerchantProduct_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "MerchantProduct_shopId_status_createdAt_idx" ON "MerchantProduct"("shopId", "status", "createdAt");
EXCEPTION WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "MerchantProduct_categoryId_idx" ON "MerchantProduct"("categoryId");
EXCEPTION WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "MerchantProduct_status_publishedAt_idx" ON "MerchantProduct"("status", "publishedAt" DESC);
EXCEPTION WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "MerchantProduct" ADD CONSTRAINT "MerchantProduct_shopId_fkey"
    FOREIGN KEY ("shopId") REFERENCES "MerchantShop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "MerchantProduct" ADD CONSTRAINT "MerchantProduct_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "MerchantProductCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "MerchantOrder" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "buyerUserId" TEXT NOT NULL,
  "sellerUserId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unitPrice" DECIMAL(14,2) NOT NULL,
  "totalAmount" DECIMAL(14,2) NOT NULL,
  "buyerCommission" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "sellerCommission" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "paymentMethod" "MarketplacePaymentMethod" NOT NULL,
  "providerRef" TEXT,
  "status" "MerchantOrderStatus" NOT NULL DEFAULT 'payment_pending',
  "paidAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MerchantOrder_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "MerchantOrder_buyerUserId_createdAt_idx" ON "MerchantOrder"("buyerUserId", "createdAt" DESC);
EXCEPTION WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "MerchantOrder_sellerUserId_createdAt_idx" ON "MerchantOrder"("sellerUserId", "createdAt" DESC);
EXCEPTION WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "MerchantOrder_productId_idx" ON "MerchantOrder"("productId");
EXCEPTION WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "MerchantOrder_status_idx" ON "MerchantOrder"("status");
EXCEPTION WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "MerchantOrder" ADD CONSTRAINT "MerchantOrder_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "MerchantProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "MerchantOrder" ADD CONSTRAINT "MerchantOrder_buyerUserId_fkey"
    FOREIGN KEY ("buyerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "MerchantOrder" ADD CONSTRAINT "MerchantOrder_sellerUserId_fkey"
    FOREIGN KEY ("sellerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "MerchantProductModerationLog" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "adminUserId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "productSnapshot" JSONB NOT NULL,
  "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MerchantProductModerationLog_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "MerchantProductModerationLog_productId_deletedAt_idx" ON "MerchantProductModerationLog"("productId", "deletedAt" DESC);
EXCEPTION WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "MerchantProductModerationLog_adminUserId_idx" ON "MerchantProductModerationLog"("adminUserId");
EXCEPTION WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "MerchantProductModerationLog" ADD CONSTRAINT "MerchantProductModerationLog_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "MerchantProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "MerchantProductModerationLog" ADD CONSTRAINT "MerchantProductModerationLog_adminUserId_fkey"
    FOREIGN KEY ("adminUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ChatRoom" ADD COLUMN IF NOT EXISTS "merchantProductId" TEXT;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "ChatRoom_merchantProductId_idx" ON "ChatRoom"("merchantProductId");
EXCEPTION WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "ChatRoom" ADD CONSTRAINT "ChatRoom_merchantProductId_fkey"
    FOREIGN KEY ("merchantProductId") REFERENCES "MerchantProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PlatformRevenue" ADD COLUMN IF NOT EXISTS "merchantOrderId" TEXT;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
DO $$ BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "PlatformRevenue_merchantOrderId_key" ON "PlatformRevenue"("merchantOrderId");
EXCEPTION WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "PlatformRevenue" ADD CONSTRAINT "PlatformRevenue_merchantOrderId_fkey"
    FOREIGN KEY ("merchantOrderId") REFERENCES "MerchantOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "UserWalletEntry" ADD COLUMN IF NOT EXISTS "merchantOrderId" TEXT;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "UserWalletEntry" ADD CONSTRAINT "UserWalletEntry_merchantOrderId_fkey"
    FOREIGN KEY ("merchantOrderId") REFERENCES "MerchantOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;
