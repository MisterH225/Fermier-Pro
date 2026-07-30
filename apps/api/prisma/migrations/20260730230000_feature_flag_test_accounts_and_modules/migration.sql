-- Allow-list comptes de test + nouveaux modules (mills, feed_composition, delivery)

-- AlterEnum
ALTER TYPE "FeatureFlagHistoryAction" ADD VALUE IF NOT EXISTS 'test_account_added';
ALTER TYPE "FeatureFlagHistoryAction" ADD VALUE IF NOT EXISTS 'test_account_removed';

-- CreateTable
CREATE TABLE "FeatureFlagTestAccount" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "addedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeatureFlagTestAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FeatureFlagTestAccount_moduleId_idx" ON "FeatureFlagTestAccount"("moduleId");

-- CreateIndex
CREATE INDEX "FeatureFlagTestAccount_userId_idx" ON "FeatureFlagTestAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureFlagTestAccount_moduleId_userId_key" ON "FeatureFlagTestAccount"("moduleId", "userId");

-- AddForeignKey
ALTER TABLE "FeatureFlagTestAccount" ADD CONSTRAINT "FeatureFlagTestAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed nouveaux modules (OFF global par défaut)
INSERT INTO "PlatformFeatureFlag" ("moduleId", "moduleName", "icon", "canDisable", "isActive", "updatedAt")
VALUES
  ('mills', 'Moulins', NULL, true, false, CURRENT_TIMESTAMP),
  ('feed_composition', 'Composition d''aliments', NULL, true, false, CURRENT_TIMESTAMP),
  ('delivery', 'Livraison', NULL, true, false, CURRENT_TIMESTAMP)
ON CONFLICT ("moduleId") DO NOTHING;
