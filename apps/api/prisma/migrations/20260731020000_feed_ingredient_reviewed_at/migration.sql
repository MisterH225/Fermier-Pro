-- Marquage validation manuelle des valeurs nutritionnelles (seed vs relu)

ALTER TABLE "FeedIngredient" ADD COLUMN "reviewedAt" TIMESTAMP(3),
ADD COLUMN "reviewedBy" TEXT;

CREATE INDEX "FeedIngredient_reviewedAt_idx" ON "FeedIngredient"("reviewedAt");
