-- CGU v1.1 : marketplace, frais plateforme, prestations vétérinaires.
-- Le contenu légal complet est aussi synchronisé par CguService (apps/api)
-- depuis cgu-default-content.ts lorsque la version applicative diffère.

DO $$ BEGIN
  UPDATE "CguSettings"
SET
  "currentVersion" = '1.1',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'current'
  AND "currentVersion" IS DISTINCT FROM '1.1';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;