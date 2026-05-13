-- Cheptel : configuration batiments/loges, dates bande, journal statuts

ALTER TABLE "Farm" ADD COLUMN "housingBuildingsCount" INTEGER;
ALTER TABLE "Farm" ADD COLUMN "housingPensPerBuilding" INTEGER;
ALTER TABLE "Farm" ADD COLUMN "housingMaxPigsPerPen" INTEGER;

ALTER TABLE "LivestockBatch" ADD COLUMN "expectedExitAt" TIMESTAMP(3);
ALTER TABLE "LivestockBatch" ADD COLUMN "closedAt" TIMESTAMP(3);

CREATE TABLE "LivestockStatusLog" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "oldStatus" TEXT,
    "newStatus" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedByUserId" TEXT NOT NULL,

    CONSTRAINT "LivestockStatusLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LivestockStatusLog_farmId_createdAt_idx" ON "LivestockStatusLog"("farmId", "createdAt");
CREATE INDEX "LivestockStatusLog_entityType_entityId_idx" ON "LivestockStatusLog"("entityType", "entityId");

ALTER TABLE "LivestockStatusLog" ADD CONSTRAINT "LivestockStatusLog_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LivestockStatusLog" ADD CONSTRAINT "LivestockStatusLog_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
