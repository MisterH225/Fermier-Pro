-- Opt-in vendeur : vente à crédit sur annonces charcutier
DO $$ BEGIN
  ALTER TABLE "MarketplaceListing" ADD COLUMN IF NOT EXISTS "creditEnabled" BOOLEAN NOT NULL DEFAULT false;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;