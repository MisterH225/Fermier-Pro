import type { PrismaClient } from "@prisma/client";

export interface E2EAdminSeedResult {
  superAdminId: string;
}

/** Attache le rôle SuperAdmin à l'utilisateur e2e mobile principal. */
export async function attachSuperAdminToUser(
  prisma: PrismaClient,
  userId: string
): Promise<E2EAdminSeedResult> {
  const row = await prisma.superAdmin.upsert({
    where: { userId },
    create: { userId },
    update: {}
  });
  return { superAdminId: row.id };
}

export async function detachSuperAdmin(
  prisma: PrismaClient,
  superAdminId: string
): Promise<void> {
  await prisma.superAdmin.deleteMany({ where: { id: superAdminId } });
}
