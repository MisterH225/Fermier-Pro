-- CreateEnum
CREATE TYPE "TechnicianFormationType" AS ENUM ('diplome', 'formation_courte', 'sur_le_tas', 'autodidacte');

-- AlterTable
ALTER TABLE "TechnicianProfile" ADD COLUMN IF NOT EXISTS "formationType" "TechnicianFormationType";
ALTER TABLE "TechnicianProfile" ADD COLUMN IF NOT EXISTS "formationDetails" TEXT;
ALTER TABLE "TechnicianProfile" ADD COLUMN IF NOT EXISTS "graduationYear" INTEGER;
ALTER TABLE "TechnicianProfile" ADD COLUMN IF NOT EXISTS "experienceYearsCount" INTEGER;
ALTER TABLE "TechnicianProfile" ADD COLUMN IF NOT EXISTS "pretensionSalarialeMensuelle" DECIMAL(14,2);
ALTER TABLE "TechnicianProfile" ADD COLUMN IF NOT EXISTS "pretensionCurrency" TEXT NOT NULL DEFAULT 'XOF';
ALTER TABLE "TechnicianProfile" ADD COLUMN IF NOT EXISTS "locationCity" TEXT;
ALTER TABLE "TechnicianProfile" ADD COLUMN IF NOT EXISTS "locationCountry" TEXT;
ALTER TABLE "TechnicianProfile" ADD COLUMN IF NOT EXISTS "locationLat" DECIMAL(10,7);
ALTER TABLE "TechnicianProfile" ADD COLUMN IF NOT EXISTS "locationLng" DECIMAL(10,7);
ALTER TABLE "TechnicianProfile" ADD COLUMN IF NOT EXISTS "isAvailable" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "TechnicianProfile" ADD COLUMN IF NOT EXISTS "availabilityNote" TEXT;
ALTER TABLE "TechnicianProfile" ADD COLUMN IF NOT EXISTS "bio" TEXT;
ALTER TABLE "TechnicianProfile" ADD COLUMN IF NOT EXISTS "isPublic" BOOLEAN NOT NULL DEFAULT true;

-- Backfill experienceYearsCount from legacy string column when possible
UPDATE "TechnicianProfile"
SET "experienceYearsCount" = NULLIF(
  regexp_replace(COALESCE("experienceYears", ''), '[^0-9]', '', 'g'),
  ''
)::INTEGER
WHERE "experienceYearsCount" IS NULL
  AND "experienceYears" IS NOT NULL
  AND regexp_replace(COALESCE("experienceYears", ''), '[^0-9]', '', 'g') <> '';
