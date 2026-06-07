-- CreateEnum
CREATE TYPE "ReceiptGenerationStatus" AS ENUM ('pending', 'generated', 'failed');

-- AlterTable
ALTER TABLE "MarketplaceTransaction"
ADD COLUMN "closedAt" TIMESTAMP(3),
ADD COLUMN "receiptGenerationStatus" "ReceiptGenerationStatus" NOT NULL DEFAULT 'pending';

-- CreateTable
CREATE TABLE "MarketplaceTransactionReceipt" (
    "id" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "pdfStoragePath" TEXT NOT NULL,
    "pdfSizeBytes" INTEGER NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receiptYear" INTEGER NOT NULL,
    "yearSequence" INTEGER NOT NULL,
    "downloadedBySeller" BOOLEAN NOT NULL DEFAULT false,
    "downloadedByBuyer" BOOLEAN NOT NULL DEFAULT false,
    "sellerDownloadedAt" TIMESTAMP(3),
    "buyerDownloadedAt" TIMESTAMP(3),

    CONSTRAINT "MarketplaceTransactionReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceTransactionReceipt_receiptNumber_key" ON "MarketplaceTransactionReceipt"("receiptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceTransactionReceipt_transactionId_key" ON "MarketplaceTransactionReceipt"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceTransactionReceipt_receiptYear_yearSequence_key" ON "MarketplaceTransactionReceipt"("receiptYear", "yearSequence");

-- CreateIndex
CREATE INDEX "MarketplaceTransactionReceipt_generatedAt_idx" ON "MarketplaceTransactionReceipt"("generatedAt" DESC);

-- CreateIndex
CREATE INDEX "MarketplaceTransactionReceipt_sellerId_idx" ON "MarketplaceTransactionReceipt"("sellerId");

-- CreateIndex
CREATE INDEX "MarketplaceTransactionReceipt_buyerId_idx" ON "MarketplaceTransactionReceipt"("buyerId");

-- AddForeignKey
ALTER TABLE "MarketplaceTransactionReceipt" ADD CONSTRAINT "MarketplaceTransactionReceipt_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "MarketplaceTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceTransactionReceipt" ADD CONSTRAINT "MarketplaceTransactionReceipt_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceTransactionReceipt" ADD CONSTRAINT "MarketplaceTransactionReceipt_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
