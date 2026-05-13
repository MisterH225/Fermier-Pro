-- CreateEnum
CREATE TYPE "FarmInvitationKind" AS ENUM ('share_link', 'scan_request');

-- CreateEnum
CREATE TYPE "FarmInvitationStatus" AS ENUM ('pending', 'accepted', 'rejected', 'expired');

-- AlterTable: role devient nullable (scan_request créé avant que l'owner attribue un rôle)
ALTER TABLE "FarmInvitation" ALTER COLUMN "role" DROP NOT NULL;

-- AlterTable: nouveaux champs « accès collaboratif » (par défaut alignés avec le comportement antérieur)
ALTER TABLE "FarmInvitation"
  ADD COLUMN "kind" "FarmInvitationKind" NOT NULL DEFAULT 'share_link',
  ADD COLUMN "status" "FarmInvitationStatus" NOT NULL DEFAULT 'pending',
  ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "permissions" JSONB,
  ADD COLUMN "recipientKind" TEXT,
  ADD COLUMN "acceptedAt" TIMESTAMP(3),
  ADD COLUMN "rejectedAt" TIMESTAMP(3),
  ADD COLUMN "scannedByUserId" TEXT;

-- Backfill: les invitations déjà acceptées passent à status=accepted ; les autres restent pending.
UPDATE "FarmInvitation"
SET "status" = 'accepted',
    "acceptedAt" = "redeemedAt"
WHERE "redeemedAt" IS NOT NULL;

-- AddForeignKey
ALTER TABLE "FarmInvitation"
  ADD CONSTRAINT "FarmInvitation_scannedByUserId_fkey"
  FOREIGN KEY ("scannedByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "FarmInvitation_farmId_kind_status_idx" ON "FarmInvitation"("farmId", "kind", "status");

-- CreateIndex
CREATE INDEX "FarmInvitation_farmId_isDefault_idx" ON "FarmInvitation"("farmId", "isDefault");
