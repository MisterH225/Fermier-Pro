-- Synced to match remote supabase_migrations.schema_migrations version.
-- Required for Supabase Preview / branching history reconciliation.

-- Source mirrored from apps/api/prisma/migrations

-- Marquage validation manuelle des valeurs nutritionnelles (seed vs relu)

ALTER TABLE "FeedIngredient" ADD COLUMN "reviewedAt" TIMESTAMP(3),
ADD COLUMN "reviewedBy" TEXT;

CREATE INDEX "FeedIngredient_reviewedAt_idx" ON "FeedIngredient"("reviewedAt");
