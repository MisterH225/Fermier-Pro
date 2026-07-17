-- Permissions granulaires par section de statistiques (deny-by-default).
ALTER TABLE "InstitutionConsoleUser"
ADD COLUMN "statSectionPermissions" JSONB NOT NULL DEFAULT '{}';
