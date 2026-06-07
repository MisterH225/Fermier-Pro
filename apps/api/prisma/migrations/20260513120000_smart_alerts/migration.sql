-- SmartAlerts (niveau 1) — alertes persistées + paramètres ferme

CREATE TYPE "SmartAlertModule" AS ENUM ('stock', 'health', 'finance', 'gestation', 'cheptel');
CREATE TYPE "SmartAlertPriority" AS ENUM ('critical', 'warning', 'info');

CREATE TABLE "FarmAlertSettings" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "mortalityRateThresholdPct" DECIMAL(8,4),
    "lowBalanceThreshold" DECIMAL(14,2),
    "stockWarningDays" INTEGER NOT NULL DEFAULT 30,
    "stockCriticalDays" INTEGER NOT NULL DEFAULT 15,
    "pushStock" BOOLEAN NOT NULL DEFAULT true,
    "pushHealth" BOOLEAN NOT NULL DEFAULT true,
    "pushFinance" BOOLEAN NOT NULL DEFAULT true,
    "pushGestation" BOOLEAN NOT NULL DEFAULT true,
    "pushCheptel" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FarmAlertSettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FarmAlertSettings_farmId_key" ON "FarmAlertSettings"("farmId");

CREATE TABLE "SmartAlert" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "ruleKey" TEXT NOT NULL,
    "module" "SmartAlertModule" NOT NULL,
    "priority" "SmartAlertPriority" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "actionRoute" TEXT,
    "actionParams" JSONB,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmartAlert_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SmartAlert_farmId_ruleKey_key" ON "SmartAlert"("farmId", "ruleKey");
CREATE INDEX "SmartAlert_farmId_priority_isRead_idx" ON "SmartAlert"("farmId", "priority", "isRead");
CREATE INDEX "SmartAlert_farmId_module_idx" ON "SmartAlert"("farmId", "module");

ALTER TABLE "FarmAlertSettings" ADD CONSTRAINT "FarmAlertSettings_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SmartAlert" ADD CONSTRAINT "SmartAlert_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
