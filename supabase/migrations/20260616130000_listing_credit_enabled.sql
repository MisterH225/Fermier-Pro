-- Opt-in vendeur : vente à crédit sur annonces charcutier
ALTER TABLE "MarketplaceListing" ADD COLUMN IF NOT EXISTS "creditEnabled" BOOLEAN NOT NULL DEFAULT false;
