-- Propositions d'ajustement véto (recalcul moteur, jamais de quantités manuelles)

CREATE TYPE "CompositionAdjustmentKind" AS ENUM ('substitute_ingredient');

CREATE TYPE "CompositionAdjustmentStatus" AS ENUM (
  'proposed',
  'applied',
  'rejected',
  'superseded'
);

CREATE TABLE "CompositionAdjustmentProposal" (
    "id" TEXT NOT NULL,
    "savedCompositionId" TEXT NOT NULL,
    "proposedByUserId" TEXT NOT NULL,
    "vetConsultationId" TEXT,
    "kind" "CompositionAdjustmentKind" NOT NULL DEFAULT 'substitute_ingredient',
    "payload" JSONB NOT NULL,
    "resultRation" JSONB NOT NULL,
    "nutritionResult" JSONB,
    "deviationFromCurrent" JSONB,
    "status" "CompositionAdjustmentStatus" NOT NULL DEFAULT 'proposed',
    "chatMessageId" TEXT,
    "previousRation" JSONB,
    "previousNutritionResult" JSONB,
    "previousTotalCostXof" DECIMAL(14,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompositionAdjustmentProposal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CompositionAdjustmentProposal_savedCompositionId_status_idx"
  ON "CompositionAdjustmentProposal"("savedCompositionId", "status");

CREATE INDEX "CompositionAdjustmentProposal_savedCompositionId_createdAt_idx"
  ON "CompositionAdjustmentProposal"("savedCompositionId", "createdAt" DESC);

CREATE INDEX "CompositionAdjustmentProposal_proposedByUserId_idx"
  ON "CompositionAdjustmentProposal"("proposedByUserId");

ALTER TABLE "CompositionAdjustmentProposal"
  ADD CONSTRAINT "CompositionAdjustmentProposal_savedCompositionId_fkey"
  FOREIGN KEY ("savedCompositionId") REFERENCES "SavedComposition"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
