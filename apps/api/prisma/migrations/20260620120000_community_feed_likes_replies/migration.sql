-- AlterTable
ALTER TABLE "CommunityFeedComment" ADD COLUMN "parentCommentId" TEXT;

-- CreateTable
CREATE TABLE "CommunityFeedLike" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "postId" TEXT,
    "commentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityFeedLike_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CommunityFeedComment_parentCommentId_idx" ON "CommunityFeedComment"("parentCommentId");

-- CreateIndex
CREATE INDEX "CommunityFeedLike_postId_idx" ON "CommunityFeedLike"("postId");

-- CreateIndex
CREATE INDEX "CommunityFeedLike_commentId_idx" ON "CommunityFeedLike"("commentId");

-- CreateIndex
CREATE UNIQUE INDEX "CommunityFeedLike_userId_postId_key" ON "CommunityFeedLike"("userId", "postId");

-- CreateIndex
CREATE UNIQUE INDEX "CommunityFeedLike_userId_commentId_key" ON "CommunityFeedLike"("userId", "commentId");

-- AddForeignKey
ALTER TABLE "CommunityFeedComment" ADD CONSTRAINT "CommunityFeedComment_parentCommentId_fkey" FOREIGN KEY ("parentCommentId") REFERENCES "CommunityFeedComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityFeedLike" ADD CONSTRAINT "CommunityFeedLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityFeedLike" ADD CONSTRAINT "CommunityFeedLike_postId_fkey" FOREIGN KEY ("postId") REFERENCES "CommunityFeedPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityFeedLike" ADD CONSTRAINT "CommunityFeedLike_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "CommunityFeedComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
