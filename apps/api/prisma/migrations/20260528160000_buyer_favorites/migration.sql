-- CreateTable
CREATE TABLE "BuyerFavorite" (
    "id" TEXT NOT NULL,
    "buyerProfileId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BuyerFavorite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BuyerFavorite_buyerProfileId_idx" ON "BuyerFavorite"("buyerProfileId");

-- CreateIndex
CREATE INDEX "BuyerFavorite_listingId_idx" ON "BuyerFavorite"("listingId");

-- CreateIndex
CREATE UNIQUE INDEX "BuyerFavorite_buyerProfileId_listingId_key" ON "BuyerFavorite"("buyerProfileId", "listingId");

-- AddForeignKey
ALTER TABLE "BuyerFavorite" ADD CONSTRAINT "BuyerFavorite_buyerProfileId_fkey" FOREIGN KEY ("buyerProfileId") REFERENCES "BuyerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuyerFavorite" ADD CONSTRAINT "BuyerFavorite_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "MarketplaceListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
