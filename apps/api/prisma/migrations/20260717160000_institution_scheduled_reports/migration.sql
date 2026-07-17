-- Rapports programmés par institution (configuration JSON).
ALTER TABLE "InstitutionConsoleUser"
ADD COLUMN "scheduledReports" JSONB NOT NULL DEFAULT '{}';
