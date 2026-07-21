-- AlterEnum: ProfileModerationStatus += deactivated
ALTER TYPE "ProfileModerationStatus" ADD VALUE IF NOT EXISTS 'deactivated';

-- AlterTable Profile: horodatage / motif de désactivation volontaire
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "deactivatedAt" TIMESTAMP(3);
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "deactivatedReason" TEXT;
