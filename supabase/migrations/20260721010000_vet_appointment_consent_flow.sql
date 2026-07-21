-- Mirror of apps/api/prisma/migrations/20260721010000_vet_appointment_consent_flow/migration.sql
DO $$ BEGIN
  CREATE TYPE "VetAppointmentStatus" AS ENUM (
    'APPOINTMENT_REQUESTED',
    'AWAITING_PAYMENT',
    'APPOINTMENT_CONFIRMED',
    'APPOINTMENT_IN_PROGRESS',
    'APPOINTMENT_COMPLETED',
    'APPOINTMENT_RATED',
    'APPOINTMENT_REFUSED',
    'PAYMENT_EXPIRED',
    'CANCELLED_BY_PRODUCER',
    'CANCELLED_BY_VET'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

ALTER TYPE "VetAppointmentStatus" ADD VALUE IF NOT EXISTS 'VISIT_PROPOSED';
ALTER TYPE "VetAppointmentStatus" ADD VALUE IF NOT EXISTS 'REFUSED_BY_PRODUCER';

DO $$ BEGIN
  ALTER TABLE "VetAppointment"
  ADD COLUMN IF NOT EXISTS "isFree" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "proposedByVetAt" TIMESTAMP(3);
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "VetAppointment_status_proposedByVetAt_idx"
    ON "VetAppointment"("status", "proposedByVetAt");
EXCEPTION WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;