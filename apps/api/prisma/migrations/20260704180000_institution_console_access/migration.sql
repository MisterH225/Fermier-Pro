-- Institution console users (accès limité plateforme admin)
CREATE TABLE "InstitutionConsoleUser" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "institutionLabel" TEXT,
    "menuPermissions" JSONB NOT NULL DEFAULT '{}',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "invitedBy" TEXT,
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstitutionConsoleUser_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InstitutionConsoleUser_userId_key" ON "InstitutionConsoleUser"("userId");
CREATE INDEX "InstitutionConsoleUser_userId_idx" ON "InstitutionConsoleUser"("userId");
CREATE INDEX "InstitutionConsoleUser_isActive_idx" ON "InstitutionConsoleUser"("isActive");

ALTER TABLE "InstitutionConsoleUser" ADD CONSTRAINT "InstitutionConsoleUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
