-- Support contact (téléphone + Telegram) configurable depuis le SaaS admin.
ALTER TABLE "PlatformSettings"
  ADD COLUMN IF NOT EXISTS "supportPhone" TEXT,
  ADD COLUMN IF NOT EXISTS "supportTelegramUrl" TEXT;
