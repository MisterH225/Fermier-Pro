-- Déduplication des relances J-5 badge « Santé vérifiée ».
CREATE TABLE "HealthBadgeExpiryReminder" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "windowKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HealthBadgeExpiryReminder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HealthBadgeExpiryReminder_farmId_windowKey_key" ON "HealthBadgeExpiryReminder"("farmId", "windowKey");

CREATE INDEX "HealthBadgeExpiryReminder_createdAt_idx" ON "HealthBadgeExpiryReminder"("createdAt");

ALTER TABLE "HealthBadgeExpiryReminder" ADD CONSTRAINT "HealthBadgeExpiryReminder_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
