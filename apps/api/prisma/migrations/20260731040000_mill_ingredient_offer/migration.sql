-- CreateEnum
CREATE TYPE "MillIngredientPackaging" AS ENUM ('kg', 'sack_50kg', 'sack_25kg', 'liter', 'ton');

-- CreateTable
CREATE TABLE "MillIngredientOffer" (
    "id" TEXT NOT NULL,
    "millProfileId" TEXT NOT NULL,
    "feedIngredientId" TEXT NOT NULL,
    "pricePerUnit" DECIMAL(14,2) NOT NULL,
    "packaging" "MillIngredientPackaging" NOT NULL,
    "unitToKg" DECIMAL(14,4) NOT NULL,
    "stockQuantity" DECIMAL(14,3) NOT NULL,
    "mixingCostPerKg" DECIMAL(14,2),
    "isPubliclyListed" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "merchantProductId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MillIngredientOffer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MillIngredientOffer_merchantProductId_key" ON "MillIngredientOffer"("merchantProductId");

-- CreateIndex
CREATE INDEX "MillIngredientOffer_feedIngredientId_isActive_idx" ON "MillIngredientOffer"("feedIngredientId", "isActive");

-- CreateIndex
CREATE INDEX "MillIngredientOffer_millProfileId_isActive_idx" ON "MillIngredientOffer"("millProfileId", "isActive");

-- CreateIndex
CREATE INDEX "MillIngredientOffer_isPubliclyListed_isActive_idx" ON "MillIngredientOffer"("isPubliclyListed", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "MillIngredientOffer_millProfileId_feedIngredientId_packaging_key" ON "MillIngredientOffer"("millProfileId", "feedIngredientId", "packaging");

-- AddForeignKey
ALTER TABLE "MillIngredientOffer" ADD CONSTRAINT "MillIngredientOffer_millProfileId_fkey" FOREIGN KEY ("millProfileId") REFERENCES "MerchantProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MillIngredientOffer" ADD CONSTRAINT "MillIngredientOffer_feedIngredientId_fkey" FOREIGN KEY ("feedIngredientId") REFERENCES "FeedIngredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MillIngredientOffer" ADD CONSTRAINT "MillIngredientOffer_merchantProductId_fkey" FOREIGN KEY ("merchantProductId") REFERENCES "MerchantProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;
