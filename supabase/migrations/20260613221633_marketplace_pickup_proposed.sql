-- Synced to match remote supabase_migrations.schema_migrations version.
-- Required for Supabase Preview / branching history reconciliation.

-- Source mirrored from apps/api/prisma/migrations

-- AlterEnum (idempotent: valeur peut déjà exister si appliquée manuellement sur Supabase)
ALTER TYPE "MarketplaceTransactionStatus" ADD VALUE IF NOT EXISTS 'PICKUP_PROPOSED';
