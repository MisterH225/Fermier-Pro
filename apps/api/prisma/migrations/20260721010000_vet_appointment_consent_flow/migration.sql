-- Consentement producteur sur propositions vétérinaires + visite gratuite explicite.
ALTER TYPE "VetAppointmentStatus" ADD VALUE IF NOT EXISTS 'VISIT_PROPOSED';
ALTER TYPE "VetAppointmentStatus" ADD VALUE IF NOT EXISTS 'REFUSED_BY_PRODUCER';

ALTER TABLE "VetAppointment"
  ADD COLUMN IF NOT EXISTS "isFree" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "proposedByVetAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "VetAppointment_status_proposedByVetAt_idx"
  ON "VetAppointment"("status", "proposedByVetAt");
