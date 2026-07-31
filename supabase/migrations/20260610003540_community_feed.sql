-- Feed communautaire : statuts utilisateur, publications, modération et appels.
-- Aligné sur apps/api/prisma/migrations/20260609120000_community_feed/migration.sql

DO $$ BEGIN
  CREATE TYPE "FeedUserStatus" AS ENUM ('active', 'warned_1', 'warned_2', 'suspended_7d', 'suspended_30d', 'banned_permanent');
EXCEPTION WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ModerationSeverity" AS ENUM ('low', 'medium', 'high');
EXCEPTION WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "SanctionAppealStatus" AS ENUM ('pending', 'accepted', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "CommunityFeedPostType" AS ENUM ('question', 'tip', 'observation', 'alert', 'success', 'medical_tip', 'technical_tip');
EXCEPTION WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "feedStatus" "FeedUserStatus" NOT NULL DEFAULT 'active';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "feedSuspensionUntil" TIMESTAMP(3);
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "feedViolationCount" INTEGER NOT NULL DEFAULT 0;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "feedViolationLastReset" TIMESTAMP(3);
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "User_feedStatus_idx" ON "User"("feedStatus");
EXCEPTION WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;
CREATE TABLE IF NOT EXISTS "CommunityFeedPost" (
    "id" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "authorProfileId" TEXT NOT NULL,
    "authorProfileType" "ProfileType" NOT NULL,
    "authorDisplayName" TEXT,
    "authorRegion" TEXT,
    "postType" "CommunityFeedPostType" NOT NULL,
    "body" TEXT NOT NULL,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "isRemoved" BOOLEAN NOT NULL DEFAULT false,
    "removedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CommunityFeedPost_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CommunityFeedComment" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "authorProfileId" TEXT NOT NULL,
    "authorProfileType" "ProfileType" NOT NULL,
    "authorDisplayName" TEXT,
    "authorRegion" TEXT,
    "body" TEXT NOT NULL,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "isRemoved" BOOLEAN NOT NULL DEFAULT false,
    "removedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CommunityFeedComment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CommunityFeedRead" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommunityFeedRead_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ModerationEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "postId" TEXT,
    "commentId" TEXT,
    "violationType" TEXT NOT NULL,
    "severity" "ModerationSeverity" NOT NULL,
    "actionTaken" TEXT NOT NULL,
    "contentSnapshot" TEXT NOT NULL,
    "aiConfidence" DECIMAL(4,3),
    "reviewedByAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ModerationEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SanctionAppeal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sanctionLevel" INTEGER NOT NULL,
    "appealMessage" TEXT NOT NULL,
    "status" "SanctionAppealStatus" NOT NULL DEFAULT 'pending',
    "adminResponse" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    CONSTRAINT "SanctionAppeal_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "CommunityFeedPost_authorUserId_createdAt_idx" ON "CommunityFeedPost"("authorUserId", "createdAt" DESC);
EXCEPTION WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "CommunityFeedPost_createdAt_idx" ON "CommunityFeedPost"("createdAt" DESC);
EXCEPTION WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "CommunityFeedPost_isRemoved_idx" ON "CommunityFeedPost"("isRemoved");
EXCEPTION WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "CommunityFeedComment_postId_createdAt_idx" ON "CommunityFeedComment"("postId", "createdAt" ASC);
EXCEPTION WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "CommunityFeedComment_authorUserId_idx" ON "CommunityFeedComment"("authorUserId");
EXCEPTION WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;
DO $$ BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "CommunityFeedRead_userId_postId_key" ON "CommunityFeedRead"("userId", "postId");
EXCEPTION WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "CommunityFeedRead_userId_idx" ON "CommunityFeedRead"("userId");
EXCEPTION WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "ModerationEvent_userId_createdAt_idx" ON "ModerationEvent"("userId", "createdAt" DESC);
EXCEPTION WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "ModerationEvent_reviewedByAdmin_createdAt_idx" ON "ModerationEvent"("reviewedByAdmin", "createdAt" DESC);
EXCEPTION WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "SanctionAppeal_userId_status_idx" ON "SanctionAppeal"("userId", "status");
EXCEPTION WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "SanctionAppeal_status_createdAt_idx" ON "SanctionAppeal"("status", "createdAt" DESC);
EXCEPTION WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "CommunityFeedPost" ADD CONSTRAINT "CommunityFeedPost_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CommunityFeedComment" ADD CONSTRAINT "CommunityFeedComment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "CommunityFeedPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CommunityFeedComment" ADD CONSTRAINT "CommunityFeedComment_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CommunityFeedRead" ADD CONSTRAINT "CommunityFeedRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CommunityFeedRead" ADD CONSTRAINT "CommunityFeedRead_postId_fkey" FOREIGN KEY ("postId") REFERENCES "CommunityFeedPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ModerationEvent" ADD CONSTRAINT "ModerationEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ModerationEvent" ADD CONSTRAINT "ModerationEvent_postId_fkey" FOREIGN KEY ("postId") REFERENCES "CommunityFeedPost"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ModerationEvent" ADD CONSTRAINT "ModerationEvent_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "CommunityFeedComment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "SanctionAppeal" ADD CONSTRAINT "SanctionAppeal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN undefined_object THEN NULL; END $$;
