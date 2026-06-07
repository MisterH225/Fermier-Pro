-- Catalogue vaccins standards + suivi par sujet/bande

CREATE TYPE "VaccineCatalogType" AS ENUM ('viral', 'bacterial', 'antiparasitic', 'other');

CREATE TABLE "StandardVaccine" (
    "id" TEXT NOT NULL,
    "farmId" TEXT,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "vaccineType" "VaccineCatalogType" NOT NULL,
    "targetCategories" JSONB NOT NULL,
    "targetLabel" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "recommendedTiming" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT '💉',
    "isStandard" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StandardVaccine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StandardVaccine_code_key" ON "StandardVaccine"("code");
CREATE UNIQUE INDEX "StandardVaccine_farmId_name_key" ON "StandardVaccine"("farmId", "name");
CREATE INDEX "StandardVaccine_farmId_idx" ON "StandardVaccine"("farmId");

ALTER TABLE "StandardVaccine" ADD CONSTRAINT "StandardVaccine_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "VaccineRecord" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "vaccineId" TEXT NOT NULL,
    "entityType" "FarmHealthEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "administeredDate" TIMESTAMP(3) NOT NULL,
    "nextDueDate" TIMESTAMP(3),
    "administeredByUserId" TEXT,
    "batchNumber" TEXT,
    "expiryDate" TIMESTAMP(3),
    "notes" TEXT,
    "healthRecordId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VaccineRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VaccineRecord_healthRecordId_key" ON "VaccineRecord"("healthRecordId");
CREATE INDEX "VaccineRecord_farmId_vaccineId_idx" ON "VaccineRecord"("farmId", "vaccineId");
CREATE INDEX "VaccineRecord_farmId_entityType_entityId_idx" ON "VaccineRecord"("farmId", "entityType", "entityId");
CREATE INDEX "VaccineRecord_farmId_vaccineId_entityType_entityId_idx" ON "VaccineRecord"("farmId", "vaccineId", "entityType", "entityId");

ALTER TABLE "VaccineRecord" ADD CONSTRAINT "VaccineRecord_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VaccineRecord" ADD CONSTRAINT "VaccineRecord_vaccineId_fkey" FOREIGN KEY ("vaccineId") REFERENCES "StandardVaccine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VaccineRecord" ADD CONSTRAINT "VaccineRecord_administeredByUserId_fkey" FOREIGN KEY ("administeredByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VaccineRecord" ADD CONSTRAINT "VaccineRecord_healthRecordId_fkey" FOREIGN KEY ("healthRecordId") REFERENCES "FarmHealthRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 10 vaccins standards porcins (farmId NULL = catalogue global)
INSERT INTO "StandardVaccine" ("id", "farmId", "code", "name", "vaccineType", "targetCategories", "targetLabel", "frequency", "recommendedTiming", "icon", "isStandard", "sortOrder", "updatedAt") VALUES
('vac_std_ppv', NULL, 'ppv', 'Parvovirose Porcine (PPV)', 'viral', '["breeding_female"]', 'Reproductrices', 'Annuel + primo-vaccination', '2-4 semaines avant saillie', '💉', true, 1, CURRENT_TIMESTAMP),
('vac_std_erysipelas', NULL, 'erysipelas', 'Rouget (Erysipèle)', 'bacterial', '["fattening","starter","breeding_female","breeding_male"]', 'Tous sujets > 8 semaines', 'Bisannuel', 'Tous les 6 mois', '💉', true, 2, CURRENT_TIMESTAMP),
('vac_std_ppc', NULL, 'ppc', 'Peste Porcine Classique (PPC)', 'viral', '["all"]', 'Tous sujets', 'Selon réglementation locale', 'Selon calendrier officiel', '⚠️', true, 3, CURRENT_TIMESTAMP),
('vac_std_prv', NULL, 'prv', 'Maladie d''Aujeszky (PRV)', 'viral', '["all"]', 'Tous sujets', 'Bisannuel', 'J0 + rappel J21 + bisannuel', '💉', true, 4, CURRENT_TIMESTAMP),
('vac_std_ecoli', NULL, 'ecoli_neonatal', 'Colibacillose néonatale (E. coli)', 'bacterial', '["breeding_female"]', 'Truies gestantes', 'Chaque gestation', 'J-4 semaines avant mise bas', '💉', true, 5, CURRENT_TIMESTAMP),
('vac_std_clostridium', NULL, 'clostridium', 'Clostridiose (C. perfringens)', 'bacterial', '["breeding_female"]', 'Truies gestantes', 'Chaque gestation', 'J-3 semaines avant mise bas', '💉', true, 6, CURRENT_TIMESTAMP),
('vac_std_sdrp', NULL, 'sdrp', 'SDRP (Syndrome Dysgénésique)', 'viral', '["breeding_female","breeding_male"]', 'Tous sujets reproducteurs', 'Annuel', 'Primovaccination + rappel annuel', '💉', true, 7, CURRENT_TIMESTAMP),
('vac_std_pcv2', NULL, 'pcv2', 'Circovirus Porcin (PCV2)', 'viral', '["starter"]', 'Porcelets sevrés', 'Une fois', '3-4 semaines après sevrage', '💉', true, 8, CURRENT_TIMESTAMP),
('vac_std_mycoplasma', NULL, 'mycoplasma', 'Pneumonie enzootique (Mycoplasma)', 'bacterial', '["starter"]', 'Porcelets', 'Une fois', 'J7-J10 après naissance', '💉', true, 9, CURRENT_TIMESTAMP),
('vac_std_app', NULL, 'app', 'Actinobacillose (APP)', 'bacterial', '["all"]', 'Tous sujets', 'Bisannuel', 'Primo + rappel J21 + bisannuel', '💉', true, 10, CURRENT_TIMESTAMP);
