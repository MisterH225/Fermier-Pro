INSERT INTO "PlatformFeatureFlag" ("moduleId", "moduleName", "icon", "canDisable", "isActive", "updatedAt")
VALUES ('wallet', 'Portefeuille', '💳', true, true, CURRENT_TIMESTAMP)
ON CONFLICT ("moduleId") DO NOTHING;
