import type { PrismaClient } from "@prisma/client";
import {
  MembershipRole,
  Prisma,
  ProfileType,
  VetVerificationStatus
} from "@prisma/client";
import { randomUUID } from "crypto";
import * as jwt from "jsonwebtoken";
import { ensureFarmFinanceBootstrap } from "../../src/finance/finance-bootstrap";

export const E2E_VET_RBAC_PRODUCER_SUB =
  "44444444-4444-4444-4444-444444444444";
export const E2E_VET_RBAC_VET_SUB = "55555555-5555-5555-5555-555555555555";

export interface E2EVetRbacSeedResult {
  prisma: PrismaClient;
  producerToken: string;
  vetToken: string;
  producerUserId: string;
  vetUserId: string;
  vetProfileId: string;
  veterinarianProfileId: string;
  farmId: string;
}

async function purgeStaleUsers(prisma: PrismaClient): Promise<void> {
  const subs = [E2E_VET_RBAC_PRODUCER_SUB, E2E_VET_RBAC_VET_SUB];
  const users = await prisma.user.findMany({
    where: { supabaseUserId: { in: subs } },
    select: { id: true, ownedFarms: { select: { id: true } } }
  });
  for (const user of users) {
    const farmIds = user.ownedFarms.map((f) => f.id);
    if (farmIds.length > 0) {
      await prisma.auditLog.deleteMany({
        where: {
          OR: [{ farmId: { in: farmIds } }, { actorUserId: user.id }]
        }
      });
      await prisma.farm.deleteMany({ where: { id: { in: farmIds } } });
    }
    await prisma.vetProfile.deleteMany({ where: { userId: user.id } });
    await prisma.profile.deleteMany({ where: { userId: user.id } });
  }
  await prisma.user.deleteMany({ where: { supabaseUserId: { in: subs } } });
}

export async function seedE2eVetRbacFixtures(
  PrismaClientCtor: typeof import("@prisma/client").PrismaClient
): Promise<E2EVetRbacSeedResult> {
  const secret = process.env.SUPABASE_JWT_SECRET?.trim();
  if (!secret) {
    throw new Error("SUPABASE_JWT_SECRET manquant (requis pour les tests e2e)");
  }

  const prisma = new PrismaClientCtor();
  await purgeStaleUsers(prisma);

  const producer = await prisma.user.create({
    data: {
      supabaseUserId: E2E_VET_RBAC_PRODUCER_SUB,
      email: "e2e-vet-rbac-producer@fermier.local",
      fullName: "E2E Vet RBAC Producteur"
    }
  });

  const producerProfile = await prisma.profile.create({
    data: {
      userId: producer.id,
      type: ProfileType.producer,
      displayName: "E2E Producteur RBAC",
      isDefault: true
    }
  });

  const farmId = randomUUID();
  const farm = await prisma.farm.create({
    data: {
      id: farmId,
      ownerId: producer.id,
      name: "Ferme test RBAC vétérinaire",
      speciesFocus: "porcin",
      livestockMode: "batch"
    }
  });

  const vetUser = await prisma.user.create({
    data: {
      supabaseUserId: E2E_VET_RBAC_VET_SUB,
      email: "e2e-vet-rbac-vet@fermier.local",
      fullName: "E2E Vet RBAC"
    }
  });

  const veterinarianProfile = await prisma.profile.create({
    data: {
      userId: vetUser.id,
      type: ProfileType.veterinarian,
      displayName: "E2E Vétérinaire RBAC",
      isDefault: true
    }
  });

  const vetProfile = await prisma.vetProfile.create({
    data: {
      userId: vetUser.id,
      fullName: "Dr E2E Vet RBAC",
      orderNumber: "VET-E2E-001",
      primarySpecialty: "Porcin",
      locationCity: "Dakar",
      locationCountry: "SN",
      professionalPhone: "+221770000000",
      schoolName: "E2E Vet School",
      schoolCountry: "SN",
      graduationYear: 2015,
      diplomaPhotoUrl: "https://example.com/e2e-diploma.jpg",
      verificationStatus: VetVerificationStatus.verified,
      verifiedAt: new Date()
    }
  });

  await prisma.farmMembership.create({
    data: {
      farmId: farm.id,
      userId: vetUser.id,
      role: MembershipRole.veterinarian,
      scopes: [],
      acceptedAt: new Date()
    }
  });

  await ensureFarmFinanceBootstrap(prisma, farm.id);
  const feedCategory = await prisma.financeCategory.findFirstOrThrow({
    where: { farmId: farm.id, key: "feed", type: "expense" }
  });
  await prisma.farmExpense.create({
    data: {
      farmId: farm.id,
      financeCategoryId: feedCategory.id,
      amount: new Prisma.Decimal(150000),
      label: "Alimentation e2e RBAC",
      occurredAt: new Date(),
      category: "Alimentation",
      note: "Dépense e2e RBAC vétérinaire",
      createdByUserId: producer.id
    }
  });

  const producerToken = jwt.sign(
    {
      sub: E2E_VET_RBAC_PRODUCER_SUB,
      email: "e2e-vet-rbac-producer@fermier.local",
      role: "authenticated"
    },
    secret,
    { expiresIn: "2h", algorithm: "HS256" }
  );

  const vetToken = jwt.sign(
    {
      sub: E2E_VET_RBAC_VET_SUB,
      email: "e2e-vet-rbac-vet@fermier.local",
      role: "authenticated"
    },
    secret,
    { expiresIn: "2h", algorithm: "HS256" }
  );

  return {
    prisma,
    producerToken,
    vetToken,
    producerUserId: producer.id,
    vetUserId: vetUser.id,
    vetProfileId: vetProfile.id,
    veterinarianProfileId: veterinarianProfile.id,
    farmId: farm.id
  };
}

export async function cleanupE2eVetRbacFixtures(
  prisma: PrismaClient,
  ctx: Pick<
    E2EVetRbacSeedResult,
    "farmId" | "producerUserId" | "vetUserId"
  >
): Promise<void> {
  try {
    await prisma.auditLog.deleteMany({
      where: {
        OR: [
          { farmId: ctx.farmId },
          { actorUserId: ctx.producerUserId },
          { actorUserId: ctx.vetUserId }
        ]
      }
    });
    await prisma.farm.delete({ where: { id: ctx.farmId } });
    await prisma.vetProfile.deleteMany({ where: { userId: ctx.vetUserId } });
    await prisma.profile.deleteMany({
      where: { userId: { in: [ctx.producerUserId, ctx.vetUserId] } }
    });
    await prisma.user.deleteMany({
      where: { id: { in: [ctx.producerUserId, ctx.vetUserId] } }
    });
  } finally {
    await prisma.$disconnect();
  }
}
