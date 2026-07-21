-- Minimal core stubs for Supabase Preview cold replay.
-- Only tables that are NEVER created by later supabase/migrations (only ALTER'd).
-- Do NOT stub tables that have a full CREATE TABLE IF NOT EXISTS later — that would
-- skip column definitions and break subsequent indexes/constraints.
-- Production already has the full Prisma schema; CREATE IF NOT EXISTS is a no-op there.

DO $$ BEGIN
  CREATE TYPE "ProfileType" AS ENUM (
    'producer',
    'technician',
    'veterinarian',
    'buyer',
    'merchant'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "User" (
  "id" TEXT PRIMARY KEY,
  "supabaseUserId" TEXT
);

CREATE TABLE IF NOT EXISTS "Farm" (
  "id" TEXT PRIMARY KEY,
  "ownerId" TEXT
);

CREATE TABLE IF NOT EXISTS "FarmMembership" (
  "id" TEXT PRIMARY KEY,
  "farmId" TEXT,
  "userId" TEXT,
  "archived" BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS "FarmTask" (
  "id" TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS "FarmInvitation" (
  "id" TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS "FarmAlertSettings" (
  "id" TEXT PRIMARY KEY,
  "farmId" TEXT
);

CREATE TABLE IF NOT EXISTS "FarmExpense" (
  "id" TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS "Gestation" (
  "id" TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS "PlatformSettings" (
  "id" TEXT PRIMARY KEY DEFAULT 'default'
);

CREATE TABLE IF NOT EXISTS "VetProfile" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT
);

CREATE TABLE IF NOT EXISTS "MarketplaceListing" (
  "id" TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS "MarketplaceOffer" (
  "id" TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS "BuyerProfile" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT
);

CREATE TABLE IF NOT EXISTS "BuyerPriceAlert" (
  "id" TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS "ProducerProfile" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT
);

CREATE TABLE IF NOT EXISTS "ChatRoom" (
  "id" TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS "UserWalletEntry" (
  "id" TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS "CguSettings" (
  "id" TEXT PRIMARY KEY
);
