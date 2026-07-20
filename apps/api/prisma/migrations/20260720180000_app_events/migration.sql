-- Events produit (adoption metrics) — props sans PII.
CREATE TABLE "AppEvent" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "userId" TEXT,
    "props" JSONB NOT NULL DEFAULT '{}',
    "dedupeKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AppEvent_dedupeKey_key" ON "AppEvent"("dedupeKey");

CREATE INDEX "AppEvent_name_createdAt_idx" ON "AppEvent"("name", "createdAt");

ALTER TABLE "AppEvent" ADD CONSTRAINT "AppEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
