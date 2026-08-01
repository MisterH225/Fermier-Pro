-- Commandes composition chez un moulin (P-J4-B) + escrow composition (P-J4-C)

CREATE TYPE "CompositionOrderStatus" AS ENUM (
  'SENT_TO_MILL',
  'MILL_REVISED',
  'ACCEPTED',
  'REJECTED',
  'CANCELLED',
  'PAID',
  'IN_PRODUCTION',
  'READY_FOR_PICKUP',
  'OUT_FOR_DELIVERY',
  'COMPLETED'
);

CREATE TABLE "CompositionOrder" (
    "id" TEXT NOT NULL,
    "savedCompositionId" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "producerUserId" TEXT NOT NULL,
    "millProfileId" TEXT NOT NULL,
    "status" "CompositionOrderStatus" NOT NULL DEFAULT 'SENT_TO_MILL',
    "snapshotRation" JSONB NOT NULL,
    "quotedPriceXof" DECIMAL(14,2) NOT NULL,
    "finalPriceXof" DECIMAL(14,2),
    "millNote" TEXT,
    "productionStartEstimate" TIMESTAMP(3),
    "readyEstimate" TIMESTAMP(3),
    "productionStartedAt" TIMESTAMP(3),
    "readyActual" TIMESTAMP(3),
    "escrowTransactionRef" TEXT,
    "paymentMethod" "MarketplacePaymentMethod",
    "paymentInitiatedAt" TIMESTAMP(3),
    "paymentConfirmedAt" TIMESTAMP(3),
    "deadlineAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompositionOrder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CompositionOrderTransition" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "fromStatus" "CompositionOrderStatus",
    "toStatus" "CompositionOrderStatus" NOT NULL,
    "event" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actorRole" TEXT NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompositionOrderTransition_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CompositionOrder_farmId_status_createdAt_idx"
  ON "CompositionOrder"("farmId", "status", "createdAt" DESC);
CREATE INDEX "CompositionOrder_producerUserId_status_idx"
  ON "CompositionOrder"("producerUserId", "status");
CREATE INDEX "CompositionOrder_millProfileId_status_idx"
  ON "CompositionOrder"("millProfileId", "status");
CREATE INDEX "CompositionOrder_savedCompositionId_idx"
  ON "CompositionOrder"("savedCompositionId");
CREATE INDEX "CompositionOrder_status_deadlineAt_idx"
  ON "CompositionOrder"("status", "deadlineAt");
CREATE INDEX "CompositionOrder_escrowTransactionRef_idx"
  ON "CompositionOrder"("escrowTransactionRef");

CREATE INDEX "CompositionOrderTransition_orderId_createdAt_idx"
  ON "CompositionOrderTransition"("orderId", "createdAt");

ALTER TABLE "CompositionOrder"
  ADD CONSTRAINT "CompositionOrder_savedCompositionId_fkey"
  FOREIGN KEY ("savedCompositionId") REFERENCES "SavedComposition"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CompositionOrder"
  ADD CONSTRAINT "CompositionOrder_farmId_fkey"
  FOREIGN KEY ("farmId") REFERENCES "Farm"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CompositionOrder"
  ADD CONSTRAINT "CompositionOrder_producerUserId_fkey"
  FOREIGN KEY ("producerUserId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CompositionOrder"
  ADD CONSTRAINT "CompositionOrder_millProfileId_fkey"
  FOREIGN KEY ("millProfileId") REFERENCES "MerchantProfile"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CompositionOrderTransition"
  ADD CONSTRAINT "CompositionOrderTransition_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "CompositionOrder"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Escrow composition : mouvement / wallet peuvent pointer vers CompositionOrder
ALTER TABLE "MarketplaceFundMovement"
  ALTER COLUMN "transactionId" DROP NOT NULL;

ALTER TABLE "MarketplaceFundMovement"
  ADD COLUMN "compositionOrderId" TEXT;

CREATE INDEX "MarketplaceFundMovement_compositionOrderId_idx"
  ON "MarketplaceFundMovement"("compositionOrderId");

ALTER TABLE "MarketplaceFundMovement"
  ADD CONSTRAINT "MarketplaceFundMovement_compositionOrderId_fkey"
  FOREIGN KEY ("compositionOrderId") REFERENCES "CompositionOrder"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserWalletEntry"
  ADD COLUMN "compositionOrderId" TEXT;

CREATE INDEX "UserWalletEntry_compositionOrderId_idx"
  ON "UserWalletEntry"("compositionOrderId");

ALTER TABLE "UserWalletEntry"
  ADD CONSTRAINT "UserWalletEntry_compositionOrderId_fkey"
  FOREIGN KEY ("compositionOrderId") REFERENCES "CompositionOrder"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

REVOKE ALL ON TABLE "CompositionOrder" FROM anon, authenticated;
REVOKE ALL ON TABLE "CompositionOrderTransition" FROM anon, authenticated;
