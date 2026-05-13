-- Module Santé unifié : dossiers santé ferme + détails + liens finance / sorties.

CREATE TYPE "FarmHealthRecordKind" AS ENUM (
  'vaccination',
  'disease',
  'vet_visit',
  'treatment',
  'mortality'
);

CREATE TYPE "FarmHealthEntityType" AS ENUM ('animal', 'group');

CREATE TYPE "FarmDiseaseCaseStatus" AS ENUM (
  'active',
  'recovered',
  'dead',
  'slaughtered'
);

CREATE TYPE "FarmMortalityCause" AS ENUM (
  'disease',
  'accident',
  'unknown',
  'other'
);

CREATE TABLE "FarmHealthRecord" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "kind" "FarmHealthRecordKind" NOT NULL,
    "entityType" "FarmHealthEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "notes" TEXT,
    "attachmentUrl" TEXT,
    "recordedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FarmHealthRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FarmHealthRecord_farmId_kind_occurredAt_idx" ON "FarmHealthRecord"("farmId", "kind", "occurredAt");

CREATE INDEX "FarmHealthRecord_farmId_entityType_entityId_idx" ON "FarmHealthRecord"("farmId", "entityType", "entityId");

ALTER TABLE "FarmHealthRecord" ADD CONSTRAINT "FarmHealthRecord_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FarmHealthRecord" ADD CONSTRAINT "FarmHealthRecord_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "HealthVaccinationDetail" (
    "healthRecordId" TEXT NOT NULL,
    "vaccineName" TEXT NOT NULL,
    "vaccineType" TEXT,
    "dose" DECIMAL(12,4),
    "doseUnit" TEXT,
    "practitioner" TEXT,
    "nextReminderAt" TIMESTAMP(3),
    "reminderDays" INTEGER,

    CONSTRAINT "HealthVaccinationDetail_pkey" PRIMARY KEY ("healthRecordId")
);

ALTER TABLE "HealthVaccinationDetail" ADD CONSTRAINT "HealthVaccinationDetail_healthRecordId_fkey" FOREIGN KEY ("healthRecordId") REFERENCES "FarmHealthRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "HealthDiseaseDetail" (
    "healthRecordId" TEXT NOT NULL,
    "symptoms" JSONB,
    "diagnosis" TEXT,
    "caseStatus" "FarmDiseaseCaseStatus" NOT NULL DEFAULT 'active',
    "linkedTreatmentRecordId" TEXT,

    CONSTRAINT "HealthDiseaseDetail_pkey" PRIMARY KEY ("healthRecordId")
);

ALTER TABLE "HealthDiseaseDetail" ADD CONSTRAINT "HealthDiseaseDetail_healthRecordId_fkey" FOREIGN KEY ("healthRecordId") REFERENCES "FarmHealthRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "HealthVetVisitDetail" (
    "healthRecordId" TEXT NOT NULL,
    "vetName" TEXT NOT NULL,
    "vetContact" TEXT,
    "reason" TEXT NOT NULL,
    "report" TEXT,
    "prescriptionUrl" TEXT,
    "cost" DECIMAL(14,2),
    "financeExpenseId" TEXT,

    CONSTRAINT "HealthVetVisitDetail_pkey" PRIMARY KEY ("healthRecordId")
);

CREATE UNIQUE INDEX "HealthVetVisitDetail_financeExpenseId_key" ON "HealthVetVisitDetail"("financeExpenseId");

ALTER TABLE "HealthVetVisitDetail" ADD CONSTRAINT "HealthVetVisitDetail_healthRecordId_fkey" FOREIGN KEY ("healthRecordId") REFERENCES "FarmHealthRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HealthVetVisitDetail" ADD CONSTRAINT "HealthVetVisitDetail_financeExpenseId_fkey" FOREIGN KEY ("financeExpenseId") REFERENCES "FarmExpense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "HealthTreatmentDetail" (
    "healthRecordId" TEXT NOT NULL,
    "drugName" TEXT NOT NULL,
    "dosage" TEXT,
    "unit" TEXT,
    "frequency" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "cost" DECIMAL(14,2),
    "financeExpenseId" TEXT,

    CONSTRAINT "HealthTreatmentDetail_pkey" PRIMARY KEY ("healthRecordId")
);

CREATE UNIQUE INDEX "HealthTreatmentDetail_financeExpenseId_key" ON "HealthTreatmentDetail"("financeExpenseId");

ALTER TABLE "HealthTreatmentDetail" ADD CONSTRAINT "HealthTreatmentDetail_healthRecordId_fkey" FOREIGN KEY ("healthRecordId") REFERENCES "FarmHealthRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HealthTreatmentDetail" ADD CONSTRAINT "HealthTreatmentDetail_financeExpenseId_fkey" FOREIGN KEY ("financeExpenseId") REFERENCES "FarmExpense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "HealthMortalityDetail" (
    "healthRecordId" TEXT NOT NULL,
    "cause" "FarmMortalityCause" NOT NULL,
    "linkedDiseaseRecordId" TEXT,
    "livestockExitId" TEXT,

    CONSTRAINT "HealthMortalityDetail_pkey" PRIMARY KEY ("healthRecordId")
);

CREATE UNIQUE INDEX "HealthMortalityDetail_livestockExitId_key" ON "HealthMortalityDetail"("livestockExitId");

ALTER TABLE "HealthMortalityDetail" ADD CONSTRAINT "HealthMortalityDetail_healthRecordId_fkey" FOREIGN KEY ("healthRecordId") REFERENCES "FarmHealthRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HealthMortalityDetail" ADD CONSTRAINT "HealthMortalityDetail_livestockExitId_fkey" FOREIGN KEY ("livestockExitId") REFERENCES "LivestockExit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
