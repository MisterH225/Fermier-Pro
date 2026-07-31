-- Synced to match remote supabase_migrations.schema_migrations version.
-- Required for Supabase Preview / branching history reconciliation.

-- Source mirrored from apps/api/prisma/migrations

-- AlterEnum: ProfileModerationStatus += deactivated
ALTER TYPE "ProfileModerationStatus" ADD VALUE IF NOT EXISTS 'deactivated';

-- AlterTable Profile: horodatage / motif de désactivation volontaire
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "deactivatedAt" TIMESTAMP(3);
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "deactivatedReason" TEXT;
