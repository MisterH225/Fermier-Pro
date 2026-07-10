import type { NestExpressApplication } from "@nestjs/platform-express";
import { PrismaClient } from "@prisma/client";
import {
  MarketplacePaymentMethod,
  MembershipRole,
  MerchantSubscriptionTier,
  ProfileType
} from "@prisma/client";
import request from "supertest";
import { createTestApp } from "./helpers/create-test-app";
import {
  cleanupE2eVetRbacFixtures,
  seedE2eVetRbacFixtures,
  type E2EVetRbacSeedResult
} from "./helpers/e2e-vet-rbac-seed";
import { creditWalletViaDevTopUp } from "./helpers/wallet-payout-e2e";

const hasDb = Boolean(process.env.DATABASE_URL?.trim());
const hasJwt = Boolean(process.env.SUPABASE_JWT_SECRET?.trim());

const describeOrSkip = hasDb && hasJwt ? describe : describe.skip;

async function isProducerSubscriptionSchemaReady(
  prisma: PrismaClient
): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ table_name: string }[]>`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'ProducerSubscriptionInvoice'
  `;
  return rows.length >= 1;
}

describeOrSkip("Producteur Premium — équipe (e2e)", () => {
  let app: NestExpressApplication;
  let ctx: E2EVetRbacSeedResult;
  let producerProfileId: string;

  beforeAll(async () => {
    process.env.THROTTLE_LIMIT = "100000";
    ctx = await seedE2eVetRbacFixtures(PrismaClient);
    if (!(await isProducerSubscriptionSchemaReady(ctx.prisma))) {
      throw new Error(
        "Schéma DB incomplet pour les e2e Premium producteur. Exécutez la migration 20260710120000."
      );
    }

    const producerProfile = await ctx.prisma.profile.findFirstOrThrow({
      where: { userId: ctx.producerUserId, type: ProfileType.producer },
      select: { id: true }
    });
    producerProfileId = producerProfile.id;

    await ctx.prisma.producerProfile.upsert({
      where: { userId: ctx.producerUserId },
      create: {
        userId: ctx.producerUserId,
        subscriptionTier: MerchantSubscriptionTier.free
      },
      update: {
        subscriptionTier: MerchantSubscriptionTier.free,
        subscriptionStatus: null,
        subscriptionChosenAt: new Date()
      }
    });

    await ctx.prisma.farmMembership.deleteMany({
      where: { farmId: ctx.farmId, role: { not: MembershipRole.owner } }
    });

    await ctx.prisma.platformSettings.upsert({
      where: { id: "default" },
      create: { id: "default", producerPremiumPriceXof: 5000 },
      update: { producerPremiumPriceXof: 5000 }
    });

    app = await createTestApp();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (ctx?.prisma) {
      await cleanupE2eVetRbacFixtures(ctx.prisma, {
        farmId: ctx.farmId,
        producerUserId: ctx.producerUserId,
        vetUserId: ctx.vetUserId
      });
    }
  });

  it("Free bloque la création d'invitation équipe", async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/farms/${ctx.farmId}/invitations`)
      .set("Authorization", `Bearer ${ctx.producerToken}`)
      .set("X-Profile-Id", producerProfileId)
      .send({ role: MembershipRole.worker });

    expect(res.status).toBe(403);
    expect(String(res.body?.message ?? "")).toMatch(/Premium producteur/i);
  });

  it("Premium wallet autorise l'invitation puis downgrade retire l'équipe", async () => {
    await creditWalletViaDevTopUp({
      app,
      token: ctx.producerToken,
      amount: 20_000
    });

    const chooseRes = await request(app.getHttpServer())
      .post("/api/v1/producers/me/subscription")
      .set("Authorization", `Bearer ${ctx.producerToken}`)
      .set("X-Profile-Id", producerProfileId)
      .send({
        tier: MerchantSubscriptionTier.premium,
        paymentMethod: MarketplacePaymentMethod.wallet
      });

    expect([200, 201]).toContain(chooseRes.status);
    expect(chooseRes.body?.teamPremiumActive).toBe(true);

    const inviteRes = await request(app.getHttpServer())
      .post(`/api/v1/farms/${ctx.farmId}/invitations`)
      .set("Authorization", `Bearer ${ctx.producerToken}`)
      .set("X-Profile-Id", producerProfileId)
      .send({ role: MembershipRole.worker });

    expect([200, 201]).toContain(inviteRes.status);

    await ctx.prisma.farmMembership.create({
      data: {
        farmId: ctx.farmId,
        userId: ctx.vetUserId,
        role: MembershipRole.veterinarian,
        scopes: []
      }
    });

    const cancelRes = await request(app.getHttpServer())
      .post("/api/v1/producers/me/subscription/cancel")
      .set("Authorization", `Bearer ${ctx.producerToken}`)
      .set("X-Profile-Id", producerProfileId)
      .send({});

    expect([200, 201]).toContain(cancelRes.status);
    expect(cancelRes.body?.teamPremiumActive).toBe(false);

    const members = await ctx.prisma.farmMembership.findMany({
      where: { farmId: ctx.farmId }
    });
    expect(members.every((m) => m.role === MembershipRole.owner)).toBe(true);
  });
});
