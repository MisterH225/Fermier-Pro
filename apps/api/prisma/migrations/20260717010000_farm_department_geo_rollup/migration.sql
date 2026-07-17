-- CreateEnum
CREATE TYPE "AdminRegionLevel" AS ENUM ('district', 'region', 'department');

-- CreateEnum
CREATE TYPE "GeoResolutionSource" AS ENUM ('gps', 'locality', 'manual', 'unresolved');

-- CreateTable
CREATE TABLE "AdminRegionRef" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" "AdminRegionLevel" NOT NULL,
    "parentCode" TEXT,

    CONSTRAINT "AdminRegionRef_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "LocalityRef" (
    "id" TEXT NOT NULL,
    "nameNormalized" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "departmentCode" TEXT NOT NULL,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),

    CONSTRAINT "LocalityRef_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Farm" ADD COLUMN "departmentCode" TEXT;
ALTER TABLE "Farm" ADD COLUMN "geoResolutionSource" "GeoResolutionSource" NOT NULL DEFAULT 'unresolved';

-- CreateIndex
CREATE INDEX "AdminRegionRef_level_idx" ON "AdminRegionRef"("level");
CREATE INDEX "AdminRegionRef_parentCode_idx" ON "AdminRegionRef"("parentCode");
CREATE INDEX "AdminRegionRef_name_idx" ON "AdminRegionRef"("name");
CREATE INDEX "LocalityRef_nameNormalized_idx" ON "LocalityRef"("nameNormalized");
CREATE INDEX "LocalityRef_departmentCode_idx" ON "LocalityRef"("departmentCode");
CREATE INDEX "Farm_departmentCode_idx" ON "Farm"("departmentCode");
CREATE INDEX "Farm_geoResolutionSource_idx" ON "Farm"("geoResolutionSource");

-- AddForeignKey
ALTER TABLE "AdminRegionRef" ADD CONSTRAINT "AdminRegionRef_parentCode_fkey" FOREIGN KEY ("parentCode") REFERENCES "AdminRegionRef"("code") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LocalityRef" ADD CONSTRAINT "LocalityRef_departmentCode_fkey" FOREIGN KEY ("departmentCode") REFERENCES "AdminRegionRef"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Farm" ADD CONSTRAINT "Farm_departmentCode_fkey" FOREIGN KEY ("departmentCode") REFERENCES "AdminRegionRef"("code") ON DELETE SET NULL ON UPDATE CASCADE;
