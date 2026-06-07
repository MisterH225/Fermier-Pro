-- Modération SuperAdmin : statut compte, statut par profil, audit, messages.

CREATE TYPE "AccountStatus" AS ENUM ('active', 'suspended', 'banned');
CREATE TYPE "ProfileModerationStatus" AS ENUM ('active', 'suspended', 'banned');
CREATE TYPE "AdminAuditTargetType" AS ENUM (
  'account',
  'vet_profile',
  'farm_profile',
  'buyer_profile',
  'technician_profile'
);
CREATE TYPE "AdminAuditAction" AS ENUM (
  'suspend',
  'unsuspend',
  'ban',
  'unban',
  'delete_profile',
  'delete_account',
  'warn',
  'message'
);
CREATE TYPE "AdminMessageType" AS ENUM ('notification', 'warning', 'info');

ALTER TABLE "User" ADD COLUMN "accountStatus" "AccountStatus" NOT NULL DEFAULT 'active';
ALTER TABLE "User" ADD COLUMN "suspendedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "suspendedReason" TEXT;
ALTER TABLE "User" ADD COLUMN "suspendedUntil" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "bannedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "bannedReason" TEXT;

CREATE INDEX "User_accountStatus_idx" ON "User"("accountStatus");

ALTER TABLE "Profile" ADD COLUMN "profileStatus" "ProfileModerationStatus" NOT NULL DEFAULT 'active';
ALTER TABLE "Profile" ADD COLUMN "profileSuspendedReason" TEXT;
ALTER TABLE "Profile" ADD COLUMN "profileSuspendedAt" TIMESTAMP(3);

CREATE INDEX "Profile_profileStatus_idx" ON "Profile"("profileStatus");

CREATE TABLE "AdminAuditLog" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "targetProfileType" "AdminAuditTargetType" NOT NULL,
    "targetProfileId" TEXT,
    "action" "AdminAuditAction" NOT NULL,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdminAuditLog_targetUserId_createdAt_idx" ON "AdminAuditLog"("targetUserId", "createdAt");
CREATE INDEX "AdminAuditLog_adminUserId_createdAt_idx" ON "AdminAuditLog"("adminUserId", "createdAt");
CREATE INDEX "AdminAuditLog_createdAt_idx" ON "AdminAuditLog"("createdAt");
CREATE INDEX "AdminAuditLog_action_idx" ON "AdminAuditLog"("action");

ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_adminUserId_fkey"
  FOREIGN KEY ("adminUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_targetUserId_fkey"
  FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AdminMessage" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "recipientUserId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" "AdminMessageType" NOT NULL DEFAULT 'notification',
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),
    CONSTRAINT "AdminMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdminMessage_recipientUserId_sentAt_idx" ON "AdminMessage"("recipientUserId", "sentAt");
CREATE INDEX "AdminMessage_recipientUserId_isRead_idx" ON "AdminMessage"("recipientUserId", "isRead");

ALTER TABLE "AdminMessage" ADD CONSTRAINT "AdminMessage_adminUserId_fkey"
  FOREIGN KEY ("adminUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdminMessage" ADD CONSTRAINT "AdminMessage_recipientUserId_fkey"
  FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
