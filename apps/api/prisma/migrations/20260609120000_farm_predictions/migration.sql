-- CreateTable
CREATE TABLE "FarmPrediction" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "predictionsJson" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataQualityScore" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "daysOfData" INTEGER NOT NULL DEFAULT 0,
    "horizonDays" INTEGER NOT NULL DEFAULT 90,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FarmPrediction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FarmPrediction_farmId_key" ON "FarmPrediction"("farmId");

-- CreateIndex
CREATE INDEX "FarmPrediction_generatedAt_idx" ON "FarmPrediction"("generatedAt");

-- AddForeignKey
ALTER TABLE "FarmPrediction" ADD CONSTRAINT "FarmPrediction_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
