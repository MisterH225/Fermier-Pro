-- CreateEnum
CREATE TYPE "TrustScoreProfileType" AS ENUM ('producer', 'buyer', 'merchant', 'vet', 'technician');

-- CreateEnum
CREATE TYPE "TrustScoreLevel" AS ENUM ('ensoleille', 'eclaircies', 'nuageux', 'orageux', 'nouvelle');

-- CreateTable
CREATE TABLE "TrustScoreSnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "profileType" "TrustScoreProfileType" NOT NULL,
    "scoreVersion" INTEGER NOT NULL,
    "pillars" JSONB NOT NULL,
    "score" INTEGER NOT NULL,
    "level" "TrustScoreLevel" NOT NULL,
    "sampleSizes" JSONB NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrustScoreSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrustScoreSnapshot_userId_profileType_computedAt_idx" ON "TrustScoreSnapshot"("userId", "profileType", "computedAt");

-- CreateIndex
CREATE INDEX "TrustScoreSnapshot_profileType_computedAt_idx" ON "TrustScoreSnapshot"("profileType", "computedAt");

-- CreateIndex
CREATE INDEX "TrustScoreSnapshot_scoreVersion_computedAt_idx" ON "TrustScoreSnapshot"("scoreVersion", "computedAt");

-- AddForeignKey
ALTER TABLE "TrustScoreSnapshot" ADD CONSTRAINT "TrustScoreSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
