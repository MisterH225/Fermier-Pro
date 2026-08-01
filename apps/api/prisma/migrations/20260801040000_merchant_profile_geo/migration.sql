-- Localisation MerchantProfile (même modèle géo que Farm / P-10)

ALTER TABLE "MerchantProfile" ADD COLUMN "latitude" DECIMAL(65,30);
ALTER TABLE "MerchantProfile" ADD COLUMN "longitude" DECIMAL(65,30);
ALTER TABLE "MerchantProfile" ADD COLUMN "locationCity" TEXT;
ALTER TABLE "MerchantProfile" ADD COLUMN "departmentCode" TEXT;
ALTER TABLE "MerchantProfile" ADD COLUMN "geoResolutionSource" "GeoResolutionSource" NOT NULL DEFAULT 'unresolved';

CREATE INDEX "MerchantProfile_departmentCode_idx" ON "MerchantProfile"("departmentCode");
CREATE INDEX "MerchantProfile_geoResolutionSource_idx" ON "MerchantProfile"("geoResolutionSource");

ALTER TABLE "MerchantProfile"
  ADD CONSTRAINT "MerchantProfile_departmentCode_fkey"
  FOREIGN KEY ("departmentCode") REFERENCES "AdminRegionRef"("code")
  ON DELETE SET NULL ON UPDATE CASCADE;
