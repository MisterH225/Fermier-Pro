-- Universal user wallet: rename buyer wallet tables and extend entry kinds.

ALTER TYPE "BuyerWalletEntryKind" RENAME TO "UserWalletEntryKind";

ALTER TYPE "UserWalletEntryKind" ADD VALUE IF NOT EXISTS 'credit_topup';
ALTER TYPE "UserWalletEntryKind" ADD VALUE IF NOT EXISTS 'debit_withdraw';
ALTER TYPE "UserWalletEntryKind" ADD VALUE IF NOT EXISTS 'credit_transfer';
ALTER TYPE "UserWalletEntryKind" ADD VALUE IF NOT EXISTS 'debit_transfer';
ALTER TYPE "UserWalletEntryKind" ADD VALUE IF NOT EXISTS 'credit_escrow_release';

ALTER TABLE "BuyerWallet" RENAME TO "UserWallet";
ALTER TABLE "BuyerWalletEntry" RENAME TO "UserWalletEntry";

ALTER TABLE "UserWallet" RENAME CONSTRAINT "BuyerWallet_pkey" TO "UserWallet_pkey";
ALTER TABLE "UserWallet" RENAME CONSTRAINT "BuyerWallet_userId_fkey" TO "UserWallet_userId_fkey";

ALTER TABLE "UserWalletEntry" RENAME CONSTRAINT "BuyerWalletEntry_pkey" TO "UserWalletEntry_pkey";
ALTER TABLE "UserWalletEntry" RENAME CONSTRAINT "BuyerWalletEntry_walletId_fkey" TO "UserWalletEntry_walletId_fkey";
ALTER TABLE "UserWalletEntry" RENAME CONSTRAINT "BuyerWalletEntry_transactionId_fkey" TO "UserWalletEntry_transactionId_fkey";

ALTER INDEX "BuyerWallet_userId_key" RENAME TO "UserWallet_userId_key";
ALTER INDEX "BuyerWalletEntry_idempotencyKey_key" RENAME TO "UserWalletEntry_idempotencyKey_key";
ALTER INDEX "BuyerWalletEntry_walletId_createdAt_idx" RENAME TO "UserWalletEntry_walletId_createdAt_idx";
ALTER INDEX "BuyerWalletEntry_transactionId_idx" RENAME TO "UserWalletEntry_transactionId_idx";

ALTER TABLE "UserWalletEntry" ADD COLUMN "counterpartyUserId" TEXT;
ALTER TABLE "UserWalletEntry" ADD COLUMN "providerRef" TEXT;

CREATE INDEX "UserWalletEntry_counterpartyUserId_idx" ON "UserWalletEntry"("counterpartyUserId");

ALTER TABLE "UserWalletEntry" ADD CONSTRAINT "UserWalletEntry_counterpartyUserId_fkey"
  FOREIGN KEY ("counterpartyUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "UserWalletEntry" ADD COLUMN "vetAppointmentId" TEXT;

CREATE INDEX "UserWalletEntry_vetAppointmentId_idx" ON "UserWalletEntry"("vetAppointmentId");

ALTER TABLE "UserWalletEntry" ADD CONSTRAINT "UserWalletEntry_vetAppointmentId_fkey"
  FOREIGN KEY ("vetAppointmentId") REFERENCES "VetAppointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "VetAppointment" ADD COLUMN "paymentMethod" "MarketplacePaymentMethod";
