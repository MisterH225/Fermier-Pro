-- AlterEnum — safe for preview branches that replay supabase/migrations
-- without the Prisma-only baseline that originally created SmartAlertModule.
DO $$ BEGIN
  CREATE TYPE "SmartAlertModule" AS ENUM (
    'stock',
    'health',
    'finance',
    'gestation',
    'cheptel'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE "SmartAlertModule" ADD VALUE IF NOT EXISTS 'market';
