-- Market porc : catégories, médias, poids/prix, vues, expirations, offres enrichies, notations ferme.

ALTER TYPE "ListingStatus" ADD VALUE 'expired';
ALTER TYPE "OfferStatus" ADD VALUE 'countered';

CREATE TYPE "ListingMarketCategory" AS ENUM ('piglet', 'breeder', 'butcher', 'reformed');

ALTER TABLE "MarketplaceListing" ADD COLUMN "category" "ListingMarketCategory",
ADD COLUMN "photoUrls" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN "animalIds" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN "totalWeightKg" DECIMAL(14,4),
ADD COLUMN "pricePerKg" DECIMAL(14,4),
ADD COLUMN "totalPrice" DECIMAL(14,2),
ADD COLUMN "breedLabel" TEXT,
ADD COLUMN "healthSummary" JSONB,
ADD COLUMN "expiresAt" TIMESTAMP(3),
ADD COLUMN "viewsCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "consultationsCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "MarketplaceOffer" ADD COLUMN "buyerFarmId" TEXT,
ADD COLUMN "proposedPricePerKg" DECIMAL(14,4),
ADD COLUMN "counterPricePerKg" DECIMAL(14,4);

CREATE TABLE "FarmMarketRating" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "ratedByUserId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FarmMarketRating_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FarmMarketRating_farmId_ratedByUserId_key" ON "FarmMarketRating"("farmId", "ratedByUserId");
CREATE INDEX "FarmMarketRating_farmId_idx" ON "FarmMarketRating"("farmId");

ALTER TABLE "FarmMarketRating" ADD CONSTRAINT "FarmMarketRating_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FarmMarketRating" ADD CONSTRAINT "FarmMarketRating_ratedByUserId_fkey" FOREIGN KEY ("ratedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "MarketplaceListing_category_idx" ON "MarketplaceListing"("category");
