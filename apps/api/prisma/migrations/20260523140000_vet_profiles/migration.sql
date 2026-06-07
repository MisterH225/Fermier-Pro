CREATE TYPE "VetVerificationStatus" AS ENUM ('pending', 'verified', 'rejected');

CREATE TABLE "VetProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "primarySpecialty" TEXT NOT NULL,
    "otherSpecialties" JSONB,
    "locationCity" TEXT NOT NULL,
    "locationCountry" TEXT NOT NULL,
    "professionalPhone" TEXT NOT NULL,
    "schoolName" TEXT NOT NULL,
    "schoolCountry" TEXT NOT NULL,
    "graduationYear" INTEGER NOT NULL,
    "diplomaPhotoUrl" TEXT NOT NULL,
    "profilePhotoUrl" TEXT,
    "bio" TEXT,
    "availability" BOOLEAN NOT NULL DEFAULT true,
    "interventionRadiusKm" INTEGER,
    "verificationStatus" "VetVerificationStatus" NOT NULL DEFAULT 'pending',
    "rejectionReason" TEXT,
    "ratingAvg" DECIMAL(3,2),
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VetProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VetProfile_userId_key" ON "VetProfile"("userId");
CREATE INDEX "VetProfile_verificationStatus_idx" ON "VetProfile"("verificationStatus");
CREATE INDEX "VetProfile_primarySpecialty_idx" ON "VetProfile"("primarySpecialty");
CREATE INDEX "VetProfile_locationCountry_locationCity_idx" ON "VetProfile"("locationCountry", "locationCity");

ALTER TABLE "VetProfile" ADD CONSTRAINT "VetProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "VetRating" (
    "id" TEXT NOT NULL,
    "vetId" TEXT NOT NULL,
    "ratedByUserId" TEXT NOT NULL,
    "ratedByFarmId" TEXT,
    "score" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VetRating_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VetRating_vetId_ratedByUserId_key" ON "VetRating"("vetId", "ratedByUserId");
CREATE INDEX "VetRating_vetId_idx" ON "VetRating"("vetId");

ALTER TABLE "VetRating" ADD CONSTRAINT "VetRating_vetId_fkey" FOREIGN KEY ("vetId") REFERENCES "VetProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VetRating" ADD CONSTRAINT "VetRating_ratedByUserId_fkey" FOREIGN KEY ("ratedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VetRating" ADD CONSTRAINT "VetRating_ratedByFarmId_fkey" FOREIGN KEY ("ratedByFarmId") REFERENCES "Farm"("id") ON DELETE SET NULL ON UPDATE CASCADE;
