-- Favoris acheteur sur produits commerçants (miroir Prisma 20260708140000_buyer_merchant_favorites)

CREATE TABLE IF NOT EXISTS "BuyerMerchantFavorite" (
  "id" TEXT NOT NULL,
  "buyerProfileId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BuyerMerchantFavorite_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "BuyerMerchantFavorite_buyerProfileId_productId_key"
  ON "BuyerMerchantFavorite"("buyerProfileId", "productId");
EXCEPTION WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "BuyerMerchantFavorite_buyerProfileId_idx"
  ON "BuyerMerchantFavorite"("buyerProfileId");
EXCEPTION WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "BuyerMerchantFavorite_productId_idx"
  ON "BuyerMerchantFavorite"("productId");
EXCEPTION WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "BuyerMerchantFavorite" ADD CONSTRAINT "BuyerMerchantFavorite_buyerProfileId_fkey"
    FOREIGN KEY ("buyerProfileId") REFERENCES "BuyerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "BuyerMerchantFavorite" ADD CONSTRAINT "BuyerMerchantFavorite_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "MerchantProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;
