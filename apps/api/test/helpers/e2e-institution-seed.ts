import type { PrismaClient } from "@prisma/client";
import type { AdminConsoleMenuPermissions } from "../../src/admin-platform/admin-console-menu.constants";
import type { InstitutionStatSectionPermissions } from "../../src/admin-platform/institution-stats-sections.constants";

export interface E2EInstitutionSeedResult {
  id: string;
}

export async function attachInstitutionConsoleUser(
  prisma: PrismaClient,
  userId: string,
  menuPermissions: AdminConsoleMenuPermissions,
  statSectionPermissions: InstitutionStatSectionPermissions = {}
): Promise<E2EInstitutionSeedResult> {
  await prisma.superAdmin.deleteMany({ where: { userId } });
  const row = await prisma.institutionConsoleUser.upsert({
    where: { userId },
    create: {
      userId,
      institutionLabel: "Institution e2e",
      menuPermissions,
      statSectionPermissions,
      isActive: true,
      acceptedAt: new Date()
    },
    update: {
      institutionLabel: "Institution e2e",
      menuPermissions,
      statSectionPermissions,
      isActive: true,
      acceptedAt: new Date()
    }
  });
  return { id: row.id };
}

export async function detachInstitutionConsoleUser(
  prisma: PrismaClient,
  institutionUserId: string
): Promise<void> {
  await prisma.institutionConsoleUser.deleteMany({
    where: { id: institutionUserId }
  });
}
