-- P-36: tolérance relative (%) combinée avec le plancher kg existant.
-- Non rétroactif côté métier : seules les nouvelles contre-déclarations appliquent la moyenne.

ALTER TABLE "PlatformSettings"
ADD COLUMN IF NOT EXISTS "marketplaceWeightTolerancePercent" DECIMAL(5,2) NOT NULL DEFAULT 3;
