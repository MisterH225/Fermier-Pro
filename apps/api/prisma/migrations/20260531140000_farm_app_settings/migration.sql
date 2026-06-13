-- FarmAppSettings (FarmProfitabilitySettings déjà créée par 20260527120000)

CREATE TABLE "FarmAppSettings" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'fr',
    "dateFormat" TEXT NOT NULL DEFAULT 'DD/MM/YYYY',
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Abidjan',
    "theme" TEXT NOT NULL DEFAULT 'light',
    "budgetAutoSuggest" BOOLEAN NOT NULL DEFAULT true,
    "dailySummaryHour" TEXT,
    "notificationExtra" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FarmAppSettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FarmAppSettings_farmId_key" ON "FarmAppSettings"("farmId");

ALTER TABLE "FarmAppSettings" ADD CONSTRAINT "FarmAppSettings_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
