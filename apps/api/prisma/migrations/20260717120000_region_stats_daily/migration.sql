-- Snapshots journaliers agrégés par département (stats console institution).
CREATE TABLE "RegionStatsDaily" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "departmentCode" TEXT NOT NULL,
    "farmCount" INTEGER NOT NULL DEFAULT 0,
    "animalCountByCategory" JSONB NOT NULL DEFAULT '{}',
    "mortalityHeadcount" INTEGER NOT NULL DEFAULT 0,
    "mortalityByCause" JSONB NOT NULL DEFAULT '{}',
    "littersCount" INTEGER NOT NULL DEFAULT 0,
    "bornAlive" INTEGER NOT NULL DEFAULT 0,
    "stillborn" INTEGER NOT NULL DEFAULT 0,
    "weanedEstimate" INTEGER NOT NULL DEFAULT 0,
    "avgGmqByCategory" JSONB NOT NULL DEFAULT '{}',
    "exitsSaleHeadcount" INTEGER NOT NULL DEFAULT 0,
    "exitsSaleAvgPricePerKg" DECIMAL(14,4),
    "exitsSlaughterHeadcount" INTEGER NOT NULL DEFAULT 0,
    "vetConsultationsCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegionStatsDaily_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RegionStatsDaily_date_departmentCode_key" ON "RegionStatsDaily"("date", "departmentCode");
CREATE INDEX "RegionStatsDaily_date_idx" ON "RegionStatsDaily"("date" DESC);
CREATE INDEX "RegionStatsDaily_departmentCode_idx" ON "RegionStatsDaily"("departmentCode");
