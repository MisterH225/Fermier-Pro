-- Synced to match remote supabase_migrations.schema_migrations version.
-- Required for Supabase Preview / branching history reconciliation.

-- Source mirrored from apps/api/prisma/migrations

-- Préfixe All (allaitement) + catégorie production nursing
ALTER TYPE "AnimalProductionCategory" ADD VALUE IF NOT EXISTS 'nursing';

ALTER TABLE "Farm" ADD COLUMN IF NOT EXISTS "lastAllTagNumber" INTEGER NOT NULL DEFAULT 0;
