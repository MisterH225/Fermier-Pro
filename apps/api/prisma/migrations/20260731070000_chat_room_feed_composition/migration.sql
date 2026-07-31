-- AlterEnum
ALTER TYPE "ChatRoomKind" ADD VALUE 'feed_composition';

-- AlterTable
ALTER TABLE "ChatRoom" ADD COLUMN "savedCompositionId" TEXT;
ALTER TABLE "ChatRoom" ADD COLUMN "vetConsultationId" TEXT;

-- CreateIndex
CREATE INDEX "ChatRoom_savedCompositionId_idx" ON "ChatRoom"("savedCompositionId");
CREATE INDEX "ChatRoom_vetConsultationId_idx" ON "ChatRoom"("vetConsultationId");

-- AddForeignKey
ALTER TABLE "ChatRoom" ADD CONSTRAINT "ChatRoom_savedCompositionId_fkey" FOREIGN KEY ("savedCompositionId") REFERENCES "SavedComposition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ChatRoom" ADD CONSTRAINT "ChatRoom_vetConsultationId_fkey" FOREIGN KEY ("vetConsultationId") REFERENCES "VetConsultation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
