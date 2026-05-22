-- Acceptation des CGU par utilisateur + paramètres version courante
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "cguAcceptedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "cguVersionAccepted" TEXT;

CREATE TABLE IF NOT EXISTS "CguSettings" (
  "id" TEXT NOT NULL DEFAULT 'current',
  "currentVersion" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "contentUrl" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CguSettings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "CguSettings" ("id", "currentVersion", "content", "updatedAt")
VALUES (
  'current',
  '1.0',
  '',
  CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO NOTHING;
