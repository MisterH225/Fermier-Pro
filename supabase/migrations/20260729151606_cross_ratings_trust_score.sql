-- Synced to match remote supabase_migrations.schema_migrations version.
-- Required for Supabase Preview / branching history reconciliation.

-- Source mirrored from apps/api/prisma/migrations

-- Additive: avis croisés buyer / merchant / technician + journal modération

CREATE TABLE "BuyerRating" (
    "id" TEXT NOT NULL,
    "buyerUserId" TEXT NOT NULL,
    "ratedByUserId" TEXT NOT NULL,
    "marketplaceTransactionId" TEXT,
    "merchantOrderId" TEXT,
    "score" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BuyerRating_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MerchantRating" (
    "id" TEXT NOT NULL,
    "merchantUserId" TEXT NOT NULL,
    "ratedByUserId" TEXT NOT NULL,
    "merchantOrderId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MerchantRating_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TechnicianRating" (
    "id" TEXT NOT NULL,
    "technicianUserId" TEXT NOT NULL,
    "ratedByUserId" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "periodYearMonth" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TechnicianRating_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CrossRatingModerationLog" (
    "id" TEXT NOT NULL,
    "ratingType" TEXT NOT NULL,
    "ratingId" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "ratingSnapshot" JSONB NOT NULL,
    "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrossRatingModerationLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BuyerRating_marketplaceTransactionId_key" ON "BuyerRating"("marketplaceTransactionId");
CREATE UNIQUE INDEX "BuyerRating_merchantOrderId_key" ON "BuyerRating"("merchantOrderId");
CREATE INDEX "BuyerRating_buyerUserId_createdAt_idx" ON "BuyerRating"("buyerUserId", "createdAt" DESC);
CREATE INDEX "BuyerRating_ratedByUserId_idx" ON "BuyerRating"("ratedByUserId");

CREATE UNIQUE INDEX "MerchantRating_merchantOrderId_key" ON "MerchantRating"("merchantOrderId");
CREATE INDEX "MerchantRating_merchantUserId_createdAt_idx" ON "MerchantRating"("merchantUserId", "createdAt" DESC);
CREATE INDEX "MerchantRating_ratedByUserId_idx" ON "MerchantRating"("ratedByUserId");

CREATE UNIQUE INDEX "TechnicianRating_technicianUserId_ratedByUserId_farmId_periodYearMonth_key" ON "TechnicianRating"("technicianUserId", "ratedByUserId", "farmId", "periodYearMonth");
CREATE INDEX "TechnicianRating_technicianUserId_createdAt_idx" ON "TechnicianRating"("technicianUserId", "createdAt" DESC);
CREATE INDEX "TechnicianRating_ratedByUserId_idx" ON "TechnicianRating"("ratedByUserId");
CREATE INDEX "TechnicianRating_farmId_idx" ON "TechnicianRating"("farmId");

CREATE INDEX "CrossRatingModerationLog_ratingType_ratingId_idx" ON "CrossRatingModerationLog"("ratingType", "ratingId");
CREATE INDEX "CrossRatingModerationLog_adminUserId_deletedAt_idx" ON "CrossRatingModerationLog"("adminUserId", "deletedAt" DESC);

ALTER TABLE "BuyerRating" ADD CONSTRAINT "BuyerRating_buyerUserId_fkey" FOREIGN KEY ("buyerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BuyerRating" ADD CONSTRAINT "BuyerRating_ratedByUserId_fkey" FOREIGN KEY ("ratedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BuyerRating" ADD CONSTRAINT "BuyerRating_marketplaceTransactionId_fkey" FOREIGN KEY ("marketplaceTransactionId") REFERENCES "MarketplaceTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BuyerRating" ADD CONSTRAINT "BuyerRating_merchantOrderId_fkey" FOREIGN KEY ("merchantOrderId") REFERENCES "MerchantOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MerchantRating" ADD CONSTRAINT "MerchantRating_merchantUserId_fkey" FOREIGN KEY ("merchantUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MerchantRating" ADD CONSTRAINT "MerchantRating_ratedByUserId_fkey" FOREIGN KEY ("ratedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MerchantRating" ADD CONSTRAINT "MerchantRating_merchantOrderId_fkey" FOREIGN KEY ("merchantOrderId") REFERENCES "MerchantOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TechnicianRating" ADD CONSTRAINT "TechnicianRating_technicianUserId_fkey" FOREIGN KEY ("technicianUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TechnicianRating" ADD CONSTRAINT "TechnicianRating_ratedByUserId_fkey" FOREIGN KEY ("ratedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TechnicianRating" ADD CONSTRAINT "TechnicianRating_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CrossRatingModerationLog" ADD CONSTRAINT "CrossRatingModerationLog_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
