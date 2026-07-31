-- Synced to match remote supabase_migrations.schema_migrations version.
-- Required for Supabase Preview / branching history reconciliation.

-- Source mirrored from apps/api/prisma/migrations

-- AlterTable SavedComposition : cache explication structurée (IA / fallback)
ALTER TABLE "SavedComposition" ADD COLUMN "explanation" JSONB;
