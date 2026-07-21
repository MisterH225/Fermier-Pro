-- Entity type « farm » pour dossiers Santé au niveau élevage
ALTER TYPE "FarmHealthEntityType" ADD VALUE IF NOT EXISTS 'farm';

-- Rapport de visite sur le RDV plateforme
ALTER TABLE "VetAppointment"
  ADD COLUMN IF NOT EXISTS "visitReportSubmittedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "visitSubjectsTreated" TEXT,
  ADD COLUMN IF NOT EXISTS "visitDiagnosis" TEXT,
  ADD COLUMN IF NOT EXISTS "visitPrescription" TEXT,
  ADD COLUMN IF NOT EXISTS "farmHealthRecordId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "VetAppointment_farmHealthRecordId_key"
  ON "VetAppointment"("farmHealthRecordId");

-- Détail visite santé enrichi
ALTER TABLE "HealthVetVisitDetail"
  ADD COLUMN IF NOT EXISTS "subjectsTreated" TEXT,
  ADD COLUMN IF NOT EXISTS "diagnosis" TEXT,
  ADD COLUMN IF NOT EXISTS "prescription" TEXT,
  ADD COLUMN IF NOT EXISTS "vetAppointmentId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "HealthVetVisitDetail_vetAppointmentId_key"
  ON "HealthVetVisitDetail"("vetAppointmentId");
