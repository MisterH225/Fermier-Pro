CREATE TYPE "PenCategory" AS ENUM (
  'starter',
  'fattening',
  'maternity',
  'quarantine',
  'mixed',
  'empty'
);

ALTER TABLE "Pen"
  ADD COLUMN IF NOT EXISTS "category" "PenCategory",
  ADD COLUMN IF NOT EXISTS "categoryForced" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "averageWeightKg" DECIMAL(10, 3),
  ADD COLUMN IF NOT EXISTS "averageAgeDays" INTEGER;
