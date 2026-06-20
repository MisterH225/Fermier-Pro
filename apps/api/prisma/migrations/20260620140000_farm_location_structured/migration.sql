-- Champs de localisation structurés pour la carte sanitaire admin (secteur / ville / pays).
ALTER TABLE "Farm" ADD COLUMN IF NOT EXISTS "locationSector" TEXT;
ALTER TABLE "Farm" ADD COLUMN IF NOT EXISTS "locationCity" TEXT;
ALTER TABLE "Farm" ADD COLUMN IF NOT EXISTS "locationCountry" TEXT;
