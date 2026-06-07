CREATE TYPE "ChatMessageModificationType" AS ENUM ('phone_masked', 'image_blocked');
CREATE TYPE "ChatSecurityEventType" AS ENUM ('phone_masked_in_text', 'image_blocked_phone', 'alphabetic_phone_attempt');

ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "wasModified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "modificationType" "ChatMessageModificationType";

CREATE TABLE IF NOT EXISTS "ChatSecurityEvent" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "farmId" TEXT,
  "eventType" "ChatSecurityEventType" NOT NULL,
  "context" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChatSecurityEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ChatSecurityEvent_userId_createdAt_idx" ON "ChatSecurityEvent"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "ChatSecurityEvent_eventType_createdAt_idx" ON "ChatSecurityEvent"("eventType", "createdAt");
CREATE INDEX IF NOT EXISTS "ChatSecurityEvent_farmId_idx" ON "ChatSecurityEvent"("farmId");

ALTER TABLE "ChatSecurityEvent" ADD CONSTRAINT "ChatSecurityEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatSecurityEvent" ADD CONSTRAINT "ChatSecurityEvent_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE SET NULL ON UPDATE CASCADE;
