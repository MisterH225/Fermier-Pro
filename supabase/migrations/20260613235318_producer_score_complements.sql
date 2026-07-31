-- Synced to match remote supabase_migrations.schema_migrations version.
-- Required for Supabase Preview / branching history reconciliation.

-- Source mirrored from apps/api/prisma/migrations

-- AlterTable
ALTER TABLE "ProducerProfile" ADD COLUMN IF NOT EXISTS "chatBuyerMessagesCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ProducerProfile" ADD COLUMN IF NOT EXISTS "chatRepliedWithin24h" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ProducerProfile" ADD COLUMN IF NOT EXISTS "creditBlocked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ProducerProfile" ADD COLUMN IF NOT EXISTS "creditBlockedReason" TEXT;
