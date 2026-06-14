-- CreateEnum
CREATE TYPE "BuyerWalletEntryKind" AS ENUM ('credit_refund', 'credit_adjustment', 'debit_escrow_hold', 'debit_adjustment');

-- CreateEnum
CREATE TYPE "MarketplacePaymentMethod" AS ENUM ('mobile_money', 'wallet');

-- CreateTable
CREATE TABLE "BuyerWallet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "balance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'XOF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BuyerWallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuyerWalletEntry" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "kind" "BuyerWalletEntryKind" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "balanceAfter" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'XOF',
    "transactionId" TEXT,
    "note" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BuyerWalletEntry_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "MarketplaceTransaction" ADD COLUMN "paymentMethod" "MarketplacePaymentMethod";

-- CreateIndex
CREATE UNIQUE INDEX "BuyerWallet_userId_key" ON "BuyerWallet"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "BuyerWalletEntry_idempotencyKey_key" ON "BuyerWalletEntry"("idempotencyKey");

-- CreateIndex
CREATE INDEX "BuyerWalletEntry_walletId_createdAt_idx" ON "BuyerWalletEntry"("walletId", "createdAt");

-- CreateIndex
CREATE INDEX "BuyerWalletEntry_transactionId_idx" ON "BuyerWalletEntry"("transactionId");

-- AddForeignKey
ALTER TABLE "BuyerWallet" ADD CONSTRAINT "BuyerWallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuyerWalletEntry" ADD CONSTRAINT "BuyerWalletEntry_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "BuyerWallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuyerWalletEntry" ADD CONSTRAINT "BuyerWalletEntry_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "MarketplaceTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
