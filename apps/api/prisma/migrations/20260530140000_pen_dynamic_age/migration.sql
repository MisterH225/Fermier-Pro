-- Âge moyen loge : fallback manuel uniquement ; calcul dynamique côté API.
ALTER TABLE "Pen" RENAME COLUMN "averageAgeWeeks" TO "averageAgeWeeksManual";

-- Données d'âge individuel pour calcul dynamique.
ALTER TABLE "Animal" ADD COLUMN "ageWeeksAtEntry" INTEGER;
ALTER TABLE "Animal" ADD COLUMN "entryDate" DATE;

UPDATE "Animal" SET "entryDate" = ("createdAt" AT TIME ZONE 'UTC')::date
WHERE "entryDate" IS NULL;
