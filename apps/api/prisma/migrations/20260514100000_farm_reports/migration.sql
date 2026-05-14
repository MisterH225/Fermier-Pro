-- Rapports ferme multi-modules

CREATE TYPE "ReportPeriodType" AS ENUM ('monthly', 'quarterly', 'yearly');

CREATE TABLE "FarmReport" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "periodType" "ReportPeriodType" NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scoreGlobal" INTEGER NOT NULL,
    "scoreBreakdown" JSONB NOT NULL,
    "dataSnapshot" JSONB NOT NULL,
    "pdfUrl" TEXT,
    "contentHash" TEXT,
    "createdByUserId" TEXT,

    CONSTRAINT "FarmReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FarmReport_farmId_generatedAt_idx" ON "FarmReport"("farmId", "generatedAt");

ALTER TABLE "FarmReport" ADD CONSTRAINT "FarmReport_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
