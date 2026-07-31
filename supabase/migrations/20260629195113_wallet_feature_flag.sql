-- Synced to match remote supabase_migrations.schema_migrations version.
-- Required for Supabase Preview / branching history reconciliation.

-- Source mirrored from apps/api/prisma/migrations

INSERT INTO "PlatformFeatureFlag" ("moduleId", "moduleName", "icon", "canDisable", "isActive", "updatedAt")
VALUES ('wallet', 'Portefeuille', '💳', true, true, CURRENT_TIMESTAMP)
ON CONFLICT ("moduleId") DO NOTHING;
