-- Localisation MerchantProfile (même modèle géo que Farm / P-10)

ALTER TABLE "MerchantProfile" ADD COLUMN IF NOT EXISTS "latitude" DECIMAL(65,30);
ALTER TABLE "MerchantProfile" ADD COLUMN IF NOT EXISTS "longitude" DECIMAL(65,30);
ALTER TABLE "MerchantProfile" ADD COLUMN IF NOT EXISTS "locationCity" TEXT;
ALTER TABLE "MerchantProfile" ADD COLUMN IF NOT EXISTS "departmentCode" TEXT;
ALTER TABLE "MerchantProfile" ADD COLUMN IF NOT EXISTS "geoResolutionSource" "GeoResolutionSource" NOT NULL DEFAULT 'unresolved';

CREATE INDEX IF NOT EXISTS "MerchantProfile_departmentCode_idx" ON "MerchantProfile"("departmentCode");
CREATE INDEX IF NOT EXISTS "MerchantProfile_geoResolutionSource_idx" ON "MerchantProfile"("geoResolutionSource");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MerchantProfile_departmentCode_fkey'
  ) THEN
    ALTER TABLE "MerchantProfile"
      ADD CONSTRAINT "MerchantProfile_departmentCode_fkey"
      FOREIGN KEY ("departmentCode") REFERENCES "AdminRegionRef"("code")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
