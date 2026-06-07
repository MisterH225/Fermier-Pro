-- Photo de profil par rôle (Profile), distincte de User.avatarUrl (legacy).
ALTER TABLE "Profile" ADD COLUMN "avatarUrl" TEXT;

UPDATE "Profile" p
SET "avatarUrl" = u."avatarUrl"
FROM "User" u
WHERE p."userId" = u.id
  AND u."avatarUrl" IS NOT NULL;
