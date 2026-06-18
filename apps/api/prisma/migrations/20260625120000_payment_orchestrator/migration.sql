-- Payment orchestrator: fees configurables, retraits avec validation admin, compte plateforme.

-- AlterEnum
ALTER TYPE "UserWalletEntryKind" ADD VALUE IF NOT EXISTS 'debit_fee';

-- CreateEnum
CREATE TYPE "WalletFeeTransactionType" AS ENUM ('deposit', 'withdrawal', 'transfer');
CREATE TYPE "WithdrawalRequestStatus" AS ENUM ('pending_review', 'processing', 'completed', 'rejected', 'failed', 'cancelled');

-- AlterTable PlatformSettings
ALTER TABLE "PlatformSettings" ADD COLUMN "withdrawalAutoApproveThreshold" DECIMAL(14,2) NOT NULL DEFAULT 50000;

-- AlterTable UserWallet
ALTER TABLE "UserWallet" ADD COLUMN "pendingBalance" DECIMAL(14,2) NOT NULL DEFAULT 0;

-- CreateTable WalletFeeConfig
CREATE TABLE "WalletFeeConfig" (
    "id" TEXT NOT NULL,
    "transactionType" "WalletFeeTransactionType" NOT NULL,
    "feePercentage" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "feeFixed" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "minFee" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "maxFee" DECIMAL(14,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WalletFeeConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable PlatformAccount
CREATE TABLE "PlatformAccount" (
    "id" TEXT NOT NULL DEFAULT 'main',
    "aggregatorBalance" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "totalVirtualBalance" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "platformFeeBalance" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "lastReconciliationAt" TIMESTAMP(3),
    "reconciliationStatus" TEXT NOT NULL DEFAULT 'pending',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable WithdrawalRequest
CREATE TABLE "WithdrawalRequest" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amountRequested" DECIMAL(14,2) NOT NULL,
    "feeAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalDebit" DECIMAL(14,2) NOT NULL,
    "amountToReceive" DECIMAL(14,2) NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "operator" TEXT,
    "status" "WithdrawalRequestStatus" NOT NULL DEFAULT 'pending_review',
    "providerRef" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "failureReason" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WithdrawalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WalletFeeConfig_transactionType_key" ON "WalletFeeConfig"("transactionType");
CREATE UNIQUE INDEX "WithdrawalRequest_idempotencyKey_key" ON "WithdrawalRequest"("idempotencyKey");
CREATE INDEX "WithdrawalRequest_userId_createdAt_idx" ON "WithdrawalRequest"("userId", "createdAt" DESC);
CREATE INDEX "WithdrawalRequest_status_createdAt_idx" ON "WithdrawalRequest"("status", "createdAt" DESC);
CREATE INDEX "WithdrawalRequest_walletId_idx" ON "WithdrawalRequest"("walletId");

-- AddForeignKey
ALTER TABLE "WithdrawalRequest" ADD CONSTRAINT "WithdrawalRequest_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "UserWallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WithdrawalRequest" ADD CONSTRAINT "WithdrawalRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WithdrawalRequest" ADD CONSTRAINT "WithdrawalRequest_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed fee configs (0 % = gratuit par défaut)
INSERT INTO "WalletFeeConfig" ("id", "transactionType", "feePercentage", "feeFixed", "minFee", "maxFee", "isActive", "updatedAt")
VALUES
  ('fee_deposit', 'deposit', 0, 0, 0, NULL, true, NOW()),
  ('fee_withdrawal', 'withdrawal', 0, 0, 0, NULL, true, NOW()),
  ('fee_transfer', 'transfer', 0, 0, 0, NULL, true, NOW())
ON CONFLICT ("transactionType") DO NOTHING;

INSERT INTO "PlatformAccount" ("id", "aggregatorBalance", "totalVirtualBalance", "platformFeeBalance", "reconciliationStatus", "updatedAt")
VALUES ('main', 0, 0, 0, 'pending', NOW())
ON CONFLICT ("id") DO NOTHING;
