-- CreateEnum
CREATE TYPE "BuyerType" AS ENUM ('individual', 'slaughterhouse', 'wholesaler', 'reseller', 'other');

-- CreateEnum
CREATE TYPE "PriceAlertFrequency" AS ENUM ('immediate', 'daily');

-- CreateTable
CREATE TABLE "TechnicianProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "experienceYears" TEXT,
    "specializations" JSONB NOT NULL DEFAULT '[]',
    "formation" TEXT,
    "profilePhotoUrl" TEXT,
    "onboardingComplete" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TechnicianProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuyerProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "buyerType" "BuyerType" NOT NULL DEFAULT 'individual',
    "businessName" TEXT,
    "locationLabel" TEXT,
    "homeLatitude" DECIMAL(10,7),
    "homeLongitude" DECIMAL(10,7),
    "searchRadiusKm" INTEGER,
    "preferredCategories" JSONB NOT NULL DEFAULT '[]',
    "priceRangeMin" DECIMAL(14,2),
    "priceRangeMax" DECIMAL(14,2),
    "typicalVolume" TEXT,
    "profilePhotoUrl" TEXT,
    "ratingAvg" DECIMAL(3,2),
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "onboardingComplete" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BuyerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuyerPriceAlert" (
    "id" TEXT NOT NULL,
    "buyerProfileId" TEXT NOT NULL,
    "animalCategory" TEXT NOT NULL,
    "maxPricePerKg" DECIMAL(14,4) NOT NULL,
    "minWeightKg" DECIMAL(14,4),
    "radiusKm" INTEGER,
    "notificationFrequency" "PriceAlertFrequency" NOT NULL DEFAULT 'immediate',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BuyerPriceAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TechnicianProfile_userId_key" ON "TechnicianProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "BuyerProfile_userId_key" ON "BuyerProfile"("userId");

-- CreateIndex
CREATE INDEX "BuyerProfile_buyerType_idx" ON "BuyerProfile"("buyerType");

-- CreateIndex
CREATE INDEX "BuyerPriceAlert_buyerProfileId_isActive_idx" ON "BuyerPriceAlert"("buyerProfileId", "isActive");

-- AddForeignKey
ALTER TABLE "TechnicianProfile" ADD CONSTRAINT "TechnicianProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuyerProfile" ADD CONSTRAINT "BuyerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuyerPriceAlert" ADD CONSTRAINT "BuyerPriceAlert_buyerProfileId_fkey" FOREIGN KEY ("buyerProfileId") REFERENCES "BuyerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
