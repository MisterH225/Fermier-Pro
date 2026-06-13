-- CreateEnum
CREATE TYPE "FarmStatus" AS ENUM ('active', 'archived');

-- AlterTable: Add multi-project fields to Farm
ALTER TABLE "Farm" ADD COLUMN "status" "FarmStatus" NOT NULL DEFAULT 'active';
ALTER TABLE "Farm" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "Farm" ADD COLUMN "displayOrder" INTEGER NOT NULL DEFAULT 0;

-- AlterTable: Add activeFarmId to User
ALTER TABLE "User" ADD COLUMN "activeFarmId" TEXT;

-- CreateIndex
CREATE INDEX "Farm_ownerId_status_idx" ON "Farm"("ownerId", "status");
CREATE INDEX "Farm_status_idx" ON "Farm"("status");
CREATE INDEX "User_activeFarmId_idx" ON "User"("activeFarmId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_activeFarmId_fkey" FOREIGN KEY ("activeFarmId") REFERENCES "Farm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Data migration: Set activeFarmId to first owned farm for each user
UPDATE "User" u
SET "activeFarmId" = (
  SELECT f.id 
  FROM "Farm" f 
  WHERE f."ownerId" = u.id 
  ORDER BY f."createdAt" ASC 
  LIMIT 1
)
WHERE EXISTS (
  SELECT 1 FROM "Farm" f WHERE f."ownerId" = u.id
);
