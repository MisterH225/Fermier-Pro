-- CreateEnum
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

CREATE TYPE "VetAppointmentConflictStatus" AS ENUM (
  'AVAILABLE',
  'CONFLICT_NEARBY',
  'CONFLICT_EXACT'
);

CREATE TYPE "VetAppointmentFundMovementKind" AS ENUM (
  'HOLD',
  'RELEASE_TO_VET',
  'REFUND_PRODUCER',
  'COMMISSION'
);

-- AlterTable VetProfile
ALTER TABLE "VetProfile"
  ADD COLUMN IF NOT EXISTS "completedAppointments" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "cancelledAppointmentsAsVet" INTEGER NOT NULL DEFAULT 0;

-- AlterTable PlatformRevenue (marketplace transaction optional)
ALTER TABLE "PlatformRevenue"
  ALTER COLUMN "transactionId" DROP NOT NULL;

ALTER TABLE "PlatformRevenue"
  ADD COLUMN IF NOT EXISTS "vetAppointmentId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "PlatformRevenue_vetAppointmentId_key"
  ON "PlatformRevenue"("vetAppointmentId");

-- CreateTable VetAppointment
CREATE TABLE "VetAppointment" (
  "id" TEXT NOT NULL,
  "farmId" TEXT NOT NULL,
  "producerUserId" TEXT NOT NULL,
  "vetProfileId" TEXT NOT NULL,
  "vetUserId" TEXT NOT NULL,
  "status" "VetAppointmentStatus" NOT NULL DEFAULT 'APPOINTMENT_REQUESTED',
  "requestedAt" TIMESTAMP(3) NOT NULL,
  "confirmedAt" TIMESTAMP(3),
  "estimatedDurationHours" DECIMAL(4,2) NOT NULL DEFAULT 1,
  "reason" TEXT NOT NULL,
  "notes" TEXT,
  "farmLocation" TEXT NOT NULL,
  "refusalReason" TEXT,
  "vetResponseNotes" TEXT,
  "servicePrice" DECIMAL(14,2),
  "commissionRate" DECIMAL(5,4) NOT NULL DEFAULT 0.05,
  "commissionAmount" DECIMAL(14,2),
  "vetReceivedAmount" DECIMAL(14,2),
  "blockedAmount" DECIMAL(14,2),
  "paymentDeadline" TIMESTAMP(3),
  "paymentConfirmedAt" TIMESTAMP(3),
  "paymentProviderRef" TEXT,
  "completedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "cancellationReason" TEXT,
  "conflictStatus" "VetAppointmentConflictStatus",
  "conflictDetails" JSONB,
  "calendarBlocked" BOOLEAN NOT NULL DEFAULT false,
  "currency" TEXT NOT NULL DEFAULT 'XOF',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "VetAppointment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VetAppointmentRating" (
  "id" TEXT NOT NULL,
  "appointmentId" TEXT NOT NULL,
  "vetProfileId" TEXT NOT NULL,
  "producerUserId" TEXT NOT NULL,
  "rating" INTEGER NOT NULL,
  "comment" TEXT,
  "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "VetAppointmentRating_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VetAppointmentFundMovement" (
  "id" TEXT NOT NULL,
  "appointmentId" TEXT NOT NULL,
  "kind" "VetAppointmentFundMovementKind" NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'XOF',
  "providerRef" TEXT,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "VetAppointmentFundMovement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VetAppointmentRating_appointmentId_key" ON "VetAppointmentRating"("appointmentId");
CREATE INDEX "VetAppointment_vetUserId_status_idx" ON "VetAppointment"("vetUserId", "status");
CREATE INDEX "VetAppointment_producerUserId_status_idx" ON "VetAppointment"("producerUserId", "status");
CREATE INDEX "VetAppointment_farmId_status_idx" ON "VetAppointment"("farmId", "status");
CREATE INDEX "VetAppointment_status_paymentDeadline_idx" ON "VetAppointment"("status", "paymentDeadline");
CREATE INDEX "VetAppointment_status_confirmedAt_idx" ON "VetAppointment"("status", "confirmedAt");
CREATE INDEX "VetAppointmentRating_vetProfileId_idx" ON "VetAppointmentRating"("vetProfileId");
CREATE INDEX "VetAppointmentFundMovement_appointmentId_idx" ON "VetAppointmentFundMovement"("appointmentId");

ALTER TABLE "VetAppointment" ADD CONSTRAINT "VetAppointment_farmId_fkey"
  FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VetAppointment" ADD CONSTRAINT "VetAppointment_producerUserId_fkey"
  FOREIGN KEY ("producerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VetAppointment" ADD CONSTRAINT "VetAppointment_vetProfileId_fkey"
  FOREIGN KEY ("vetProfileId") REFERENCES "VetProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VetAppointment" ADD CONSTRAINT "VetAppointment_vetUserId_fkey"
  FOREIGN KEY ("vetUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "VetAppointmentRating" ADD CONSTRAINT "VetAppointmentRating_appointmentId_fkey"
  FOREIGN KEY ("appointmentId") REFERENCES "VetAppointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VetAppointmentRating" ADD CONSTRAINT "VetAppointmentRating_vetProfileId_fkey"
  FOREIGN KEY ("vetProfileId") REFERENCES "VetProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VetAppointmentFundMovement" ADD CONSTRAINT "VetAppointmentFundMovement_appointmentId_fkey"
  FOREIGN KEY ("appointmentId") REFERENCES "VetAppointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PlatformRevenue" ADD CONSTRAINT "PlatformRevenue_vetAppointmentId_fkey"
  FOREIGN KEY ("vetAppointmentId") REFERENCES "VetAppointment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
