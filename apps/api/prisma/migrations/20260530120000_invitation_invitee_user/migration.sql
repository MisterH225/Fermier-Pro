-- Invitation par identifiant (téléphone/email) : on relie directement
-- l'invitation à un User cible (quand on a trouvé un compte existant) et
-- on stocke un message personnel optionnel saisi par l'inviteur.

ALTER TABLE "FarmInvitation"
  ADD COLUMN IF NOT EXISTS "inviteeUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "message" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'FarmInvitation_inviteeUserId_fkey'
  ) THEN
    ALTER TABLE "FarmInvitation"
      ADD CONSTRAINT "FarmInvitation_inviteeUserId_fkey"
      FOREIGN KEY ("inviteeUserId") REFERENCES "User"("id") ON DELETE SET NULL;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS "FarmInvitation_inviteeUserId_status_idx"
  ON "FarmInvitation"("inviteeUserId", "status");
