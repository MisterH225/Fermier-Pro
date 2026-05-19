-- Onboarding producteur (première configuration projet / cheptel)
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "isOnboarded" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "onboardingSkipped" BOOLEAN NOT NULL DEFAULT false;

-- Comptes déjà dotés d’une ferme : considérés comme onboardés
UPDATE "User" u
SET "isOnboarded" = true
WHERE EXISTS (
  SELECT 1 FROM "Farm" f WHERE f."ownerId" = u.id
);
