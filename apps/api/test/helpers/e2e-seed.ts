import type { PrismaClient } from "@prisma/client";
import { AnimalSex, ProfileType } from "@prisma/client";
import * as jwt from "jsonwebtoken";

/** Sub JWT stable pour retrouver / purger l’utilisateur de test. */
export const E2E_SUPABASE_SUB = "11111111-1111-1111-1111-111111111111";

export interface E2ESeedResult {
  prisma: PrismaClient;
  token: string;
  userId: string;
  farmId: string;
  batchId: string;
  animalId: string;
  producerProfileId: string;
}

async function purgeStaleE2eUser(prisma: PrismaClient): Promise<void> {
  const existing = await prisma.user.findUnique({
    where: { supabaseUserId: E2E_SUPABASE_SUB },
    include: { ownedFarms: { select: { id: true } } }
  });
  if (!existing) {
    return;
  }
  const farmIds = existing.ownedFarms.map((f) => f.id);
  if (farmIds.length > 0) {
    await prisma.auditLog.deleteMany({
      where: {
        OR: [{ farmId: { in: farmIds } }, { actorUserId: existing.id }]
      }
    });
    await prisma.farm.deleteMany({ where: { id: { in: farmIds } } });
  }
  await prisma.marketplaceListing.deleteMany({
    where: { sellerUserId: existing.id }
  });
  await prisma.profile.deleteMany({ where: { userId: existing.id } });
  await prisma.user.delete({ where: { id: existing.id } });
}

export async function seedE2eFixtures(
  PrismaClientCtor: typeof import("@prisma/client").PrismaClient
): Promise<E2ESeedResult> {
  const secret = process.env.SUPABASE_JWT_SECRET?.trim();
  if (!secret) {
    throw new Error("SUPABASE_JWT_SECRET manquant (requis pour les tests e2e)");
  }

  const prisma = new PrismaClientCtor();
  await purgeStaleE2eUser(prisma);

  await prisma.species.upsert({
    where: { code: "porcin" },
    create: { code: "porcin", name: "Porcin", sortOrder: 0 },
    update: {}
  });

  const species = await prisma.species.findUniqueOrThrow({
    where: { code: "porcin" }
  });

  const user = await prisma.user.create({
    data: {
      supabaseUserId: E2E_SUPABASE_SUB,
      email: "e2e-mobile-contract@fermier.local",
      fullName: "E2E Mobile Contract"
    }
  });

  const producerProfile = await prisma.profile.create({
    data: {
      userId: user.id,
      type: ProfileType.producer,
      displayName: "E2E Producteur",
      isDefault: true
    }
  });

  const farm = await prisma.farm.create({
    data: {
      ownerId: user.id,
      name: "Ferme test contrat mobile",
      speciesFocus: "porcin",
      livestockMode: "batch"
    }
  });

  const batch = await prisma.livestockBatch.create({
    data: {
      farmId: farm.id,
      speciesId: species.id,
      name: "Bande test E2E",
      headcount: 42,
      status: "active"
    }
  });

  const animal = await prisma.animal.create({
    data: {
      farmId: farm.id,
      speciesId: species.id,
      sex: AnimalSex.unknown,
      status: "active"
    }
  });

  const token = jwt.sign(
    {
      sub: E2E_SUPABASE_SUB,
      email: "e2e-mobile-contract@fermier.local",
      role: "authenticated"
    },
    secret,
    { expiresIn: "2h", algorithm: "HS256" }
  );

  return {
    prisma,
    token,
    userId: user.id,
    farmId: farm.id,
    batchId: batch.id,
    animalId: animal.id,
    producerProfileId: producerProfile.id
  };
}

export async function cleanupE2eFixtures(
  prisma: PrismaClient,
  ctx: Pick<E2ESeedResult, "farmId" | "userId">
): Promise<void> {
  try {
    await prisma.marketplaceListing.deleteMany({
      where: { sellerUserId: ctx.userId }
    });
    await prisma.auditLog.deleteMany({
      where: {
        OR: [{ farmId: ctx.farmId }, { actorUserId: ctx.userId }]
      }
    });
    await prisma.farm.delete({ where: { id: ctx.farmId } });
    await prisma.profile.deleteMany({ where: { userId: ctx.userId } });
    await prisma.user.delete({ where: { id: ctx.userId } });
  } finally {
    await prisma.$disconnect();
  }
}
