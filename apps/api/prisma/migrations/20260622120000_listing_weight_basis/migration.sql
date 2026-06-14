-- Idempotent : la migration peut avoir été pré-appliquée via Supabase MCP.
DO $$ BEGIN
  CREATE TYPE "ListingWeightBasis" AS ENUM ('live', 'carcass');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "MarketplaceListing"
  ADD COLUMN IF NOT EXISTS "weightBasis" "ListingWeightBasis";
