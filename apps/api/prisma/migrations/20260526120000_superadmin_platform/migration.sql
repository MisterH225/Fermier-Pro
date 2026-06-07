-- Console SuperAdmin : comptes admin, alertes sanitaires, paramètres plateforme.

CREATE TABLE "SuperAdmin" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SuperAdmin_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SuperAdmin_userId_key" ON "SuperAdmin"("userId");
CREATE INDEX "SuperAdmin_userId_idx" ON "SuperAdmin"("userId");
ALTER TABLE "SuperAdmin" ADD CONSTRAINT "SuperAdmin_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TYPE "SanitaryAlertType" AS ENUM ('auto', 'manual');
CREATE TYPE "SanitaryAlertLevel" AS ENUM ('info', 'warning', 'critical');

CREATE TABLE "SanitaryAlert" (
    "id" TEXT NOT NULL,
    "zoneName" TEXT NOT NULL,
    "countryCode" TEXT,
    "regionCode" TEXT,
    "alertType" "SanitaryAlertType" NOT NULL,
    "level" "SanitaryAlertLevel" NOT NULL DEFAULT 'warning',
    "diseaseName" TEXT,
    "caseCount" INTEGER,
    "message" TEXT NOT NULL,
    "createdBy" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    CONSTRAINT "SanitaryAlert_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SanitaryAlert_isActive_createdAt_idx" ON "SanitaryAlert"("isActive", "createdAt");
CREATE INDEX "SanitaryAlert_countryCode_idx" ON "SanitaryAlert"("countryCode");

CREATE TABLE "PlatformSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "mapGeographicScope" TEXT NOT NULL DEFAULT 'west_africa',
    "mapCountryCodes" JSONB,
    "alertCaseThreshold" INTEGER NOT NULL DEFAULT 5,
    "alertPeriodDays" INTEGER NOT NULL DEFAULT 30,
    "alertDefaultLevel" "SanitaryAlertLevel" NOT NULL DEFAULT 'warning',
    "adminNotifyEmail" TEXT,
    "reportFrequencyDays" INTEGER NOT NULL DEFAULT 7,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlatformSettings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "PlatformSettings" ("id", "updatedAt")
VALUES ('default', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
