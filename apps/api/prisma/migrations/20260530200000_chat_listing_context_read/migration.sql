-- Contexte marketplace + suivi de lecture des conversations
ALTER TABLE "ChatRoom" ADD COLUMN IF NOT EXISTS "marketplaceListingId" TEXT;

ALTER TABLE "ChatRoomMember" ADD COLUMN IF NOT EXISTS "lastReadAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "ChatRoom_marketplaceListingId_idx" ON "ChatRoom"("marketplaceListingId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ChatRoom_marketplaceListingId_fkey'
  ) THEN
    ALTER TABLE "ChatRoom"
      ADD CONSTRAINT "ChatRoom_marketplaceListingId_fkey"
      FOREIGN KEY ("marketplaceListingId") REFERENCES "MarketplaceListing"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
