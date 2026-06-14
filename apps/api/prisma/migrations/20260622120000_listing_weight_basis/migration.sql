-- CreateEnum
CREATE TYPE "ListingWeightBasis" AS ENUM ('live', 'carcass');

-- AlterTable
ALTER TABLE "MarketplaceListing" ADD COLUMN "weightBasis" "ListingWeightBasis";
