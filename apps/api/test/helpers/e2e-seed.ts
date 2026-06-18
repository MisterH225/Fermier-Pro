import type { PrismaClient } from "@prisma/client";
import {
  AnimalSex,
  MembershipRole,
  ProfileType,
  VaccineCatalogType
} from "@prisma/client";
import * as jwt from "jsonwebtoken";

/** Sub JWT stable pour retrouver / purger l’utilisateur de test. */
export const E2E_SUPABASE_SUB = "11111111-1111-1111-1111-111111111111";

/** Sub du pair annuaire (invitation e2e, chat directory). */
export const E2E_PEER_SUPABASE_SUB = "22222222-2222-2222-2222-222222222222";

export interface E2ESeedResult {
  prisma: PrismaClient;
  token: string;
  /** JWT pour le second utilisateur (annuaire / invitation accept). */
  peerToken: string;
  userId: string;
  peerUserId: string;
  farmId: string;
  batchId: string;
  animalId: string;
  producerProfileId: string;
}

/** Supprime tous les enregistrements marketplace liés à ces utilisateurs (acheteur ou vendeur). */
async function purgeMarketplaceForUsers(
  prisma: PrismaClient,
  userIds: string[]
): Promise<void> {
  if (userIds.length === 0) return;
  await prisma.marketplaceTransactionReceipt.deleteMany({
    where: { OR: [{ sellerId: { in: userIds } }, { buyerId: { in: userIds } }] }
  });
  await prisma.marketplaceFundMovement.deleteMany({
    where: {
      transaction: {
        OR: [{ sellerUserId: { in: userIds } }, { buyerUserId: { in: userIds } }]
      }
    }
  });
  await prisma.platformRevenue.deleteMany({
    where: {
      OR: [{ sellerId: { in: userIds } }, { buyerId: { in: userIds } }]
    }
  });
  await prisma.marketplacePendingTransfer.deleteMany({
    where: { buyerUserId: { in: userIds } }
  });
  await prisma.marketplaceDeliveryDispute.deleteMany({
    where: {
      transaction: {
        OR: [{ sellerUserId: { in: userIds } }, { buyerUserId: { in: userIds } }]
      }
    }
  });
  await prisma.marketplaceTransaction.deleteMany({
    where: { OR: [{ sellerUserId: { in: userIds } }, { buyerUserId: { in: userIds } }] }
  });
  await prisma.marketplaceCreditArbitration.deleteMany({
    where: { OR: [{ buyerUserId: { in: userIds } }, { sellerUserId: { in: userIds } }] }
  });
  await prisma.marketplaceOffer.deleteMany({
    where: {
      OR: [
        { buyerUserId: { in: userIds } },
        { listing: { sellerUserId: { in: userIds } } }
      ]
    }
  });
}

async function purgeStaleE2eUser(prisma: PrismaClient): Promise<void> {
  const peer = await prisma.user.findUnique({
    where: { email: "e2e-peer-directory@fermier.local" },
    select: { id: true }
  });
  if (peer) {
    await purgeMarketplaceForUsers(prisma, [peer.id]);
    await prisma.farm.deleteMany({ where: { ownerId: peer.id } });
    await prisma.adminAuditLog.deleteMany({ where: { adminUserId: peer.id } });
    await prisma.adminMessage.deleteMany({ where: { adminUserId: peer.id } });
    await prisma.user.delete({ where: { id: peer.id } });
  }
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
  await purgeMarketplaceForUsers(prisma, [existing.id]);
  await prisma.marketplaceListing.deleteMany({
    where: { sellerUserId: existing.id }
  });
  await prisma.adminAuditLog.deleteMany({ where: { adminUserId: existing.id } });
  await prisma.adminMessage.deleteMany({ where: { adminUserId: existing.id } });
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

  // Vaccins standard : normalement insérés par la migration SQL mais absents en CI (prisma:push uniquement)
  await prisma.standardVaccine.createMany({
    skipDuplicates: true,
    data: [
      { id: "vac_std_ppv", code: "ppv", name: "Parvovirose Porcine (PPV)", vaccineType: VaccineCatalogType.viral, targetCategories: ["breeding_female"], targetLabel: "Reproductrices", frequency: "Annuel + primo-vaccination", recommendedTiming: "2-4 semaines avant saillie", icon: "💉", isStandard: true, sortOrder: 1 },
      { id: "vac_std_erysipelas", code: "erysipelas", name: "Rouget (Erysipèle)", vaccineType: VaccineCatalogType.bacterial, targetCategories: ["fattening","starter","breeding_female","breeding_male"], targetLabel: "Tous sujets > 8 semaines", frequency: "Bisannuel", recommendedTiming: "Tous les 6 mois", icon: "💉", isStandard: true, sortOrder: 2 },
      { id: "vac_std_ppc", code: "ppc", name: "Peste Porcine Classique (PPC)", vaccineType: VaccineCatalogType.viral, targetCategories: ["all"], targetLabel: "Tous sujets", frequency: "Selon réglementation locale", recommendedTiming: "Selon calendrier officiel", icon: "⚠️", isStandard: true, sortOrder: 3 },
      { id: "vac_std_prv", code: "prv", name: "Maladie d'Aujeszky (PRV)", vaccineType: VaccineCatalogType.viral, targetCategories: ["all"], targetLabel: "Tous sujets", frequency: "Bisannuel", recommendedTiming: "J0 + rappel J21 + bisannuel", icon: "💉", isStandard: true, sortOrder: 4 },
      { id: "vac_std_ecoli", code: "ecoli_neonatal", name: "Colibacillose néonatale (E. coli)", vaccineType: VaccineCatalogType.bacterial, targetCategories: ["breeding_female"], targetLabel: "Truies gestantes", frequency: "Chaque gestation", recommendedTiming: "J-4 semaines avant mise bas", icon: "💉", isStandard: true, sortOrder: 5 },
      { id: "vac_std_clostridium", code: "clostridium", name: "Clostridiose (C. perfringens)", vaccineType: VaccineCatalogType.bacterial, targetCategories: ["breeding_female"], targetLabel: "Truies gestantes", frequency: "Chaque gestation", recommendedTiming: "J-3 semaines avant mise bas", icon: "💉", isStandard: true, sortOrder: 6 },
      { id: "vac_std_sdrp", code: "sdrp", name: "SDRP (Syndrome Dysgénésique)", vaccineType: VaccineCatalogType.viral, targetCategories: ["breeding_female","breeding_male"], targetLabel: "Tous sujets reproducteurs", frequency: "Annuel", recommendedTiming: "Primovaccination + rappel annuel", icon: "💉", isStandard: true, sortOrder: 7 },
      { id: "vac_std_pcv2", code: "pcv2", name: "Circovirus Porcin (PCV2)", vaccineType: VaccineCatalogType.viral, targetCategories: ["starter"], targetLabel: "Porcelets sevrés", frequency: "Une fois", recommendedTiming: "3-4 semaines après sevrage", icon: "💉", isStandard: true, sortOrder: 8 },
      { id: "vac_std_mycoplasma", code: "mycoplasma", name: "Pneumonie enzootique (Mycoplasma)", vaccineType: VaccineCatalogType.bacterial, targetCategories: ["starter"], targetLabel: "Porcelets", frequency: "Une fois", recommendedTiming: "J7-J10 après naissance", icon: "💉", isStandard: true, sortOrder: 9 },
      { id: "vac_std_app", code: "app", name: "Actinobacillose (APP)", vaccineType: VaccineCatalogType.bacterial, targetCategories: ["all"], targetLabel: "Tous sujets", frequency: "Bisannuel", recommendedTiming: "Primo + rappel J21 + bisannuel", icon: "💉", isStandard: true, sortOrder: 10 }
    ]
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

  const peerUser = await prisma.user.create({
    data: {
      supabaseUserId: E2E_PEER_SUPABASE_SUB,
      email: "e2e-peer-directory@fermier.local",
      fullName: "E2E Peer Annuaire"
    }
  });

  await prisma.farmMembership.create({
    data: {
      farmId: farm.id,
      userId: peerUser.id,
      role: MembershipRole.worker,
      scopes: []
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

  const farrowingDue = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
  const animal = await prisma.animal.create({
    data: {
      farmId: farm.id,
      speciesId: species.id,
      sex: AnimalSex.unknown,
      status: "active",
      expectedFarrowingAt: farrowingDue
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

  const peerToken = jwt.sign(
    {
      sub: E2E_PEER_SUPABASE_SUB,
      email: "e2e-peer-directory@fermier.local",
      role: "authenticated"
    },
    secret,
    { expiresIn: "2h", algorithm: "HS256" }
  );

  return {
    prisma,
    token,
    peerToken,
    userId: user.id,
    peerUserId: peerUser.id,
    farmId: farm.id,
    batchId: batch.id,
    animalId: animal.id,
    producerProfileId: producerProfile.id
  };
}

export async function cleanupE2eFixtures(
  prisma: PrismaClient,
  ctx: Pick<E2ESeedResult, "farmId" | "userId" | "peerUserId">
): Promise<void> {
  const userIds = [ctx.userId, ctx.peerUserId];
  try {
    await purgeMarketplaceForUsers(prisma, userIds);
    await prisma.marketplaceListing.deleteMany({
      where: { sellerUserId: { in: userIds } }
    });
    await prisma.chatMessage.deleteMany({
      where: { senderUserId: { in: userIds } }
    });
    await prisma.chatRoom.deleteMany({
      where: { members: { some: { userId: { in: userIds } } } }
    });
    await prisma.auditLog.deleteMany({
      where: {
        OR: [
          { farmId: ctx.farmId },
          { actorUserId: ctx.userId },
          { actorUserId: ctx.peerUserId }
        ]
      }
    });
    await prisma.farm.delete({ where: { id: ctx.farmId } });
    await prisma.adminAuditLog.deleteMany({
      where: { adminUserId: { in: userIds } }
    });
    await prisma.adminMessage.deleteMany({
      where: { adminUserId: { in: userIds } }
    });
    await prisma.profile.deleteMany({
      where: { userId: { in: userIds } }
    });
    await prisma.user.deleteMany({
      where: { id: { in: userIds } }
    });
  } finally {
    await prisma.$disconnect();
  }
}
