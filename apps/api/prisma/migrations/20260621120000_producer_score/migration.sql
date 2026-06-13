-- CreateEnum
CREATE TYPE "ProducerScore" AS ENUM ('excellent', 'bon', 'nouveau', 'attention', 'risque');

-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastActiveAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ProducerProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "producerScore" "ProducerScore" NOT NULL DEFAULT 'nouveau',
    "dataRegularityScore" INTEGER NOT NULL DEFAULT 0,
    "platformUsageScore" INTEGER NOT NULL DEFAULT 0,
    "responsivenessScore" INTEGER NOT NULL DEFAULT 0,
    "dataEntryDaysLast30" INTEGER NOT NULL DEFAULT 0,
    "platformActiveDaysLast30" INTEGER NOT NULL DEFAULT 0,
    "offersReceivedCount" INTEGER NOT NULL DEFAULT 0,
    "offersRespondedWithin48h" INTEGER NOT NULL DEFAULT 0,
    "creditBalancesOnTime" INTEGER NOT NULL DEFAULT 0,
    "creditBalancesTotal" INTEGER NOT NULL DEFAULT 0,
    "scoreUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProducerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProducerProfile_userId_key" ON "ProducerProfile"("userId");

-- CreateIndex
CREATE INDEX "ProducerProfile_producerScore_idx" ON "ProducerProfile"("producerScore");

-- AddForeignKey
ALTER TABLE "ProducerProfile" ADD CONSTRAINT "ProducerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
