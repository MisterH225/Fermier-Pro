-- Unifie les maladies sur FarmHealthRecord + healthStatus animal (séparé du statut lifecycle).

CREATE TYPE "AnimalHealthStatus" AS ENUM ('healthy', 'sick', 'recovering');

CREATE TYPE "FarmDiseaseSeverity" AS ENUM ('mild', 'moderate', 'severe');

ALTER TABLE "Animal" ADD COLUMN "healthStatus" "AnimalHealthStatus" NOT NULL DEFAULT 'healthy';

CREATE INDEX "Animal_farmId_healthStatus_idx" ON "Animal"("farmId", "healthStatus");

ALTER TABLE "HealthDiseaseDetail" ADD COLUMN "severity" "FarmDiseaseSeverity";
ALTER TABLE "HealthDiseaseDetail" ADD COLUMN "durationEstimate" TEXT;
ALTER TABLE "HealthDiseaseDetail" ADD COLUMN "inIsolation" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "HealthDiseaseDetail" ADD COLUMN "treatmentOngoing" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "HealthDiseaseDetail" ADD COLUMN "resolvedAt" TIMESTAMP(3);

-- Migration AnimalHealthEvent → FarmHealthRecord (kind=disease), en conservant les IDs.
INSERT INTO "FarmHealthRecord" (
  "id",
  "farmId",
  "kind",
  "entityType",
  "entityId",
  "occurredAt",
  "status",
  "notes",
  "recordedByUserId",
  "createdAt",
  "updatedAt"
)
SELECT
  ahe."id",
  an."farmId",
  'disease'::"FarmHealthRecordKind",
  'animal'::"FarmHealthEntityType",
  ahe."animalId",
  ahe."recordedAt",
  'completed',
  ahe."body",
  ahe."recordedByUserId",
  ahe."recordedAt",
  ahe."recordedAt"
FROM "AnimalHealthEvent" ahe
INNER JOIN "Animal" an ON an."id" = ahe."animalId"
WHERE NOT EXISTS (
  SELECT 1 FROM "FarmHealthRecord" fhr WHERE fhr."id" = ahe."id"
);

INSERT INTO "HealthDiseaseDetail" (
  "healthRecordId",
  "diagnosis",
  "caseStatus",
  "severity",
  "symptoms"
)
SELECT
  ahe."id",
  ahe."title",
  CASE
    WHEN ahe."severity" IN ('watch', 'urgent')
      AND ahe."recordedAt" >= NOW() - INTERVAL '30 days'
      THEN 'active'::"FarmDiseaseCaseStatus"
    ELSE 'recovered'::"FarmDiseaseCaseStatus"
  END,
  CASE ahe."severity"
    WHEN 'info' THEN 'mild'::"FarmDiseaseSeverity"
    WHEN 'watch' THEN 'moderate'::"FarmDiseaseSeverity"
    WHEN 'urgent' THEN 'severe'::"FarmDiseaseSeverity"
    ELSE 'mild'::"FarmDiseaseSeverity"
  END,
  jsonb_build_object('legacySeverity', ahe."severity"::text)
FROM "AnimalHealthEvent" ahe
WHERE NOT EXISTS (
  SELECT 1 FROM "HealthDiseaseDetail" hdd WHERE hdd."healthRecordId" = ahe."id"
);

UPDATE "HealthDiseaseDetail" hdd
SET "resolvedAt" = fhr."occurredAt"
FROM "FarmHealthRecord" fhr
WHERE hdd."healthRecordId" = fhr."id"
  AND hdd."caseStatus" = 'recovered'
  AND hdd."resolvedAt" IS NULL;

UPDATE "Animal" a
SET "healthStatus" = 'sick'::"AnimalHealthStatus"
WHERE a."status" = 'active'
  AND EXISTS (
    SELECT 1
    FROM "FarmHealthRecord" fhr
    INNER JOIN "HealthDiseaseDetail" hdd ON hdd."healthRecordId" = fhr."id"
    WHERE fhr."entityType" = 'animal'
      AND fhr."entityId" = a."id"
      AND fhr."kind" = 'disease'
      AND hdd."caseStatus" = 'active'
  );

ALTER TABLE "AnimalHealthEvent" DROP CONSTRAINT "AnimalHealthEvent_animalId_fkey";
ALTER TABLE "AnimalHealthEvent" DROP CONSTRAINT "AnimalHealthEvent_recordedByUserId_fkey";
DROP TABLE "AnimalHealthEvent";
