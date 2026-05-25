-- Renomme Pen.averageAgeDays → Pen.averageAgeWeeks puis convertit les valeurs
-- existantes (jours → semaines entières, arrondi le plus proche).
ALTER TABLE "Pen" RENAME COLUMN "averageAgeDays" TO "averageAgeWeeks";
UPDATE "Pen"
SET "averageAgeWeeks" = ROUND("averageAgeWeeks"::numeric / 7)
WHERE "averageAgeWeeks" IS NOT NULL;

-- Seuils configurables par ferme pour la requalification des loges démarrage.
ALTER TABLE "FarmAlertSettings"
  ADD COLUMN IF NOT EXISTS "starterMaxAvgWeightKg" DECIMAL(10, 3) DEFAULT 30,
  ADD COLUMN IF NOT EXISTS "starterMaxAvgAgeWeeks" INTEGER DEFAULT 10;
