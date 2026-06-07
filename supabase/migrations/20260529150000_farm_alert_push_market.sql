-- AlterTable
ALTER TABLE "FarmAlertSettings" ADD COLUMN IF NOT EXISTS "pushMarket" BOOLEAN NOT NULL DEFAULT true;
