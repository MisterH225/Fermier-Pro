import type { NestExpressApplication } from "@nestjs/platform-express";
import { AnimalSex, PrismaClient } from "@prisma/client";
import request from "supertest";
import { createTestApp } from "./helpers/create-test-app";
import {
  cleanupE2eFixtures,
  seedE2eFixtures,
  type E2ESeedResult
} from "./helpers/e2e-seed";

const hasDb = Boolean(process.env.DATABASE_URL?.trim());
const hasJwt = Boolean(process.env.SUPABASE_JWT_SECRET?.trim());
const describeOrSkip = hasDb && hasJwt ? describe : describe.skip;

describeOrSkip("Marketplace vente à crédit (e2e)", () => {
  let app: NestExpressApplication;
  let ctx: E2ESeedResult;
  let listingId: string;

  beforeAll(async () => {
    process.env.THROTTLE_LIMIT = "100000";
    ctx = await seedE2eFixtures(PrismaClient);
    app = await createTestApp();

    const species = await ctx.prisma.species.findUniqueOrThrow({
      where: { code: "porcin" }
    });
    const animal = await ctx.prisma.animal.create({
      data: {
        farmId: ctx.farmId,
        speciesId: species.id,
        sex: AnimalSex.unknown,
        status: "active"
      }
    });

    const listingRes = await request(app.getHttpServer())
      .post("/api/v1/marketplace/listings")
      .set("Authorization", `Bearer ${ctx.token}`)
      .set("X-Profile-Id", ctx.producerProfileId)
      .send({
        title: "E2E charcutier crédit",
        farmId: ctx.farmId,
        animalId: animal.id,
        category: "butcher",
        totalPrice: 100_000,
        totalWeightKg: 80
      });
    listingId = listingRes.body.id;
    await request(app.getHttpServer())
      .post(`/api/v1/marketplace/listings/${listingId}/publish`)
      .set("Authorization", `Bearer ${ctx.token}`)
      .set("X-Profile-Id", ctx.producerProfileId)
      .send({ durationDays: 14 });
  });

  afterAll(async () => {
    if (app) await app.close();
    if (ctx?.prisma) {
      await ctx.prisma.marketplaceOffer.deleteMany({
        where: { listing: { sellerUserId: ctx.userId } }
      });
      await cleanupE2eFixtures(ctx.prisma, {
        farmId: ctx.farmId,
        userId: ctx.userId,
        peerUserId: ctx.peerUserId
      });
    }
  });

  it("refuse crédit sur porcelet", async () => {
    const pigletAnimal = await ctx.prisma.animal.create({
      data: {
        farmId: ctx.farmId,
        speciesId: (
          await ctx.prisma.species.findUniqueOrThrow({ where: { code: "porcin" } })
        ).id,
        sex: AnimalSex.unknown,
        status: "active"
      }
    });
    const piglet = await request(app.getHttpServer())
      .post("/api/v1/marketplace/listings")
      .set("Authorization", `Bearer ${ctx.token}`)
      .set("X-Profile-Id", ctx.producerProfileId)
      .send({
        title: "Porcelet",
        farmId: ctx.farmId,
        animalId: pigletAnimal.id,
        category: "piglet",
        totalPrice: 50_000
      });
    await request(app.getHttpServer())
      .post(`/api/v1/marketplace/listings/${piglet.body.id}/publish`)
      .set("Authorization", `Bearer ${ctx.token}`)
      .set("X-Profile-Id", ctx.producerProfileId)
      .send({ durationDays: 14 });
    const res = await request(app.getHttpServer())
      .post(`/api/v1/marketplace/listings/${piglet.body.id}/offers/credit`)
      .set("Authorization", `Bearer ${ctx.peerToken}`)
      .send({
        offeredPrice: 50_000,
        advancePercentage: 30,
        balanceDueDays: 2
      });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it("crée une offre à crédit charcutier et accord", async () => {
    const create = await request(app.getHttpServer())
      .post(`/api/v1/marketplace/listings/${listingId}/offers/credit`)
      .set("Authorization", `Bearer ${ctx.peerToken}`)
      .send({
        offeredPrice: 100_000,
        advancePercentage: 30,
        balanceDueDays: 2,
        message: "Revendeur E2E"
      });
    expect([200, 201]).toContain(create.status);
    expect(create.body.offerType).toBe("credit");

    const offerId = create.body.id as string;
    const agree = await request(app.getHttpServer())
      .patch(
        `/api/v1/marketplace/listings/${listingId}/offers/${offerId}/agree-credit`
      )
      .set("Authorization", `Bearer ${ctx.token}`)
      .set("X-Profile-Id", ctx.producerProfileId);
    expect(agree.status).toBe(200);
    expect(agree.body.status).toBe("credit_agreed");
  });
});
