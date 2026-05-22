-- CreateEnum
CREATE TYPE "GestationStatus" AS ENUM ('active', 'completed', 'aborted', 'lost');
CREATE TYPE "MatingType" AS ENUM ('natural', 'artificial_insemination');
CREATE TYPE "GestationDeliveryType" AS ENUM ('normal', 'difficult', 'cesarean');
CREATE TYPE "GestationVaccineStatus" AS ENUM ('pending', 'done', 'overdue', 'skipped');

-- CreateTable
CREATE TABLE "Gestation" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "sowId" TEXT NOT NULL,
    "boarId" TEXT,
    "matingType" "MatingType" NOT NULL,
    "matingDate" TIMESTAMP(3) NOT NULL,
    "expectedBirthDate" TIMESTAMP(3) NOT NULL,
    "actualBirthDate" TIMESTAMP(3),
    "gestationNumber" INTEGER NOT NULL DEFAULT 1,
    "status" "GestationStatus" NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Gestation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Litter" (
    "id" TEXT NOT NULL,
    "gestationId" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "bornAlive" INTEGER NOT NULL,
    "stillborn" INTEGER NOT NULL DEFAULT 0,
    "mummified" INTEGER NOT NULL DEFAULT 0,
    "averageBirthWeightKg" DECIMAL(10,3),
    "deliveryType" "GestationDeliveryType" NOT NULL DEFAULT 'normal',
    "vetAssistance" BOOLEAN NOT NULL DEFAULT false,
    "weaningDate" TIMESTAMP(3),
    "starterBatchId" TEXT,
    "notes" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Litter_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GestationVaccine" (
    "id" TEXT NOT NULL,
    "gestationId" TEXT NOT NULL,
    "vaccineName" TEXT NOT NULL,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "administeredDate" TIMESTAMP(3),
    "status" "GestationVaccineStatus" NOT NULL DEFAULT 'pending',
    "linkedHealthRecordId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GestationVaccine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GestationChecklistItem" (
    "id" TEXT NOT NULL,
    "gestationId" TEXT NOT NULL,
    "itemLabel" TEXT NOT NULL,
    "isChecked" BOOLEAN NOT NULL DEFAULT false,
    "checkedAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GestationChecklistItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GestationSettings" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "gestationDurationDays" INTEGER NOT NULL DEFAULT 114,
    "weaningDurationDays" INTEGER NOT NULL DEFAULT 28,
    "vaccineSchedule" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GestationSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Litter_gestationId_key" ON "Litter"("gestationId");
CREATE UNIQUE INDEX "GestationSettings_farmId_key" ON "GestationSettings"("farmId");
CREATE INDEX "Gestation_farmId_status_idx" ON "Gestation"("farmId", "status");
CREATE INDEX "Gestation_farmId_expectedBirthDate_idx" ON "Gestation"("farmId", "expectedBirthDate");
CREATE INDEX "Gestation_sowId_idx" ON "Gestation"("sowId");
CREATE INDEX "Litter_farmId_idx" ON "Litter"("farmId");
CREATE INDEX "GestationVaccine_gestationId_idx" ON "GestationVaccine"("gestationId");
CREATE INDEX "GestationVaccine_gestationId_status_idx" ON "GestationVaccine"("gestationId", "status");
CREATE INDEX "GestationChecklistItem_gestationId_idx" ON "GestationChecklistItem"("gestationId");

-- AddForeignKey
ALTER TABLE "Gestation" ADD CONSTRAINT "Gestation_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Gestation" ADD CONSTRAINT "Gestation_sowId_fkey" FOREIGN KEY ("sowId") REFERENCES "Animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Gestation" ADD CONSTRAINT "Gestation_boarId_fkey" FOREIGN KEY ("boarId") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Litter" ADD CONSTRAINT "Litter_gestationId_fkey" FOREIGN KEY ("gestationId") REFERENCES "Gestation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GestationVaccine" ADD CONSTRAINT "GestationVaccine_gestationId_fkey" FOREIGN KEY ("gestationId") REFERENCES "Gestation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GestationChecklistItem" ADD CONSTRAINT "GestationChecklistItem_gestationId_fkey" FOREIGN KEY ("gestationId") REFERENCES "Gestation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GestationSettings" ADD CONSTRAINT "GestationSettings_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
