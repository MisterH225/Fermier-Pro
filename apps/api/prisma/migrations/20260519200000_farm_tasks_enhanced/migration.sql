-- CreateEnum
CREATE TYPE "TaskReminder" AS ENUM ('j_minus_1', 'j_zero', 'both');

-- CreateEnum
CREATE TYPE "TaskNotificationType" AS ENUM ('assigned', 'reminder', 'overdue', 'escalation', 'completed');

-- AlterTable
ALTER TABLE "FarmTask" ADD COLUMN "reminder" "TaskReminder",
ADD COLUMN "completedByUserId" TEXT,
ADD COLUMN "animalId" TEXT;

-- CreateTable
CREATE TABLE "TaskNotification" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "TaskNotificationType" NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isRead" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "TaskNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FarmTask_farmId_dueAt_idx" ON "FarmTask"("farmId", "dueAt");

-- CreateIndex
CREATE INDEX "FarmTask_animalId_idx" ON "FarmTask"("animalId");

-- CreateIndex
CREATE INDEX "TaskNotification_taskId_type_idx" ON "TaskNotification"("taskId", "type");

-- CreateIndex
CREATE INDEX "TaskNotification_userId_isRead_idx" ON "TaskNotification"("userId", "isRead");

-- AddForeignKey
ALTER TABLE "FarmTask" ADD CONSTRAINT "FarmTask_completedByUserId_fkey" FOREIGN KEY ("completedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FarmTask" ADD CONSTRAINT "FarmTask_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskNotification" ADD CONSTRAINT "TaskNotification_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "FarmTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskNotification" ADD CONSTRAINT "TaskNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
