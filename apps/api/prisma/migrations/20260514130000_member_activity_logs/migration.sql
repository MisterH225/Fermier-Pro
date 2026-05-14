-- Migration : MemberActivityLog + extensions FarmMembership

-- Ajout des champs sur FarmMembership
ALTER TABLE "FarmMembership" ADD COLUMN IF NOT EXISTS "permissions" JSONB;
ALTER TABLE "FarmMembership" ADD COLUMN IF NOT EXISTS "invitedAt" TIMESTAMP(3);
ALTER TABLE "FarmMembership" ADD COLUMN IF NOT EXISTS "acceptedAt" TIMESTAMP(3);

-- Enum MemberActivityModule
CREATE TYPE "MemberActivityModule" AS ENUM (
  'cheptel',
  'health',
  'finance',
  'stock',
  'gestation',
  'collaboration'
);

-- Modèle MemberActivityLog
CREATE TABLE "MemberActivityLog" (
  "id"        TEXT NOT NULL,
  "farmId"    TEXT NOT NULL,
  "memberId"  TEXT NOT NULL,
  "module"    "MemberActivityModule" NOT NULL,
  "action"    TEXT NOT NULL,
  "detail"    JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MemberActivityLog_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "MemberActivityLog"
  ADD CONSTRAINT "MemberActivityLog_farmId_fkey"
    FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MemberActivityLog"
  ADD CONSTRAINT "MemberActivityLog_memberId_fkey"
    FOREIGN KEY ("memberId") REFERENCES "FarmMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "MemberActivityLog_farmId_createdAt_idx" ON "MemberActivityLog"("farmId", "createdAt");
CREATE INDEX "MemberActivityLog_farmId_memberId_idx" ON "MemberActivityLog"("farmId", "memberId");
