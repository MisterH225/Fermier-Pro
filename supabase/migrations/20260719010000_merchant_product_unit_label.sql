-- Unité de vente libre sur les produits commerçant.
ALTER TABLE "MerchantProduct"
  ADD COLUMN IF NOT EXISTS "unitLabel" TEXT;
