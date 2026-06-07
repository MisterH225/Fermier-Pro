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
      await ctx.prisma.marketplaceCreditArbitration.deleteMany({
        where: { listing: { sellerUserId: ctx.userId } }
      });
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

  it("refuse accept standard sur offre crédit", async () => {
    const create = await request(app.getHttpServer())
      .post(`/api/v1/marketplace/listings/${listingId}/offers/credit`)
      .set("Authorization", `Bearer ${ctx.peerToken}`)
      .send({
        offeredPrice: 90_000,
        advancePercentage: 25,
        balanceDueDays: 3,
        message: "Test guard standard"
      });
    expect([200, 201]).toContain(create.status);
    const offerId = create.body.id as string;
    const accept = await request(app.getHttpServer())
      .post(`/api/v1/marketplace/listings/${listingId}/offers/${offerId}/accept`)
      .set("Authorization", `Bearer ${ctx.token}`)
      .set("X-Profile-Id", ctx.producerProfileId);
    expect(accept.status).toBeGreaterThanOrEqual(400);
  });

  it("crée offre crédit, contre-proposition et accord", async () => {
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
    const counter = await request(app.getHttpServer())
      .patch(
        `/api/v1/marketplace/listings/${listingId}/offers/${offerId}/counter-credit`
      )
      .set("Authorization", `Bearer ${ctx.token}`)
      .set("X-Profile-Id", ctx.producerProfileId)
      .send({
        offeredPrice: 95_000,
        advancePercentage: 40,
        balanceDueDays: 3
      });
    expect(counter.status).toBe(200);
    expect(counter.body.status).toBe("countered");

    const agree = await request(app.getHttpServer())
      .patch(
        `/api/v1/marketplace/listings/${listingId}/offers/${offerId}/agree-credit`
      )
      .set("Authorization", `Bearer ${ctx.peerToken}`);
    expect(agree.status).toBe(200);
    expect(agree.body.status).toBe("credit_agreed");
    expect(agree.body.advancePercentage).toBe(40);
  });

  it("flux avance : déclaration, double ignore, confirmation vendeur", async () => {
    const offer = await ctx.prisma.marketplaceOffer.findFirstOrThrow({
      where: { listingId, offerType: "credit", status: "credit_agreed" }
    });

    const declare1 = await request(app.getHttpServer())
      .patch(`/api/v1/marketplace/offers/${offer.id}/confirm-advance-paid`)
      .set("Authorization", `Bearer ${ctx.peerToken}`)
      .send({ paymentMode: "Mobile Money", paymentRef: "MM-001" });
    expect(declare1.status).toBe(200);
    expect(declare1.body.advancePaidDeclaredAt).toBeTruthy();

    const declare2 = await request(app.getHttpServer())
      .patch(`/api/v1/marketplace/offers/${offer.id}/confirm-advance-paid`)
      .set("Authorization", `Bearer ${ctx.peerToken}`)
      .send({ paymentMode: "Espèces" });
    expect(declare2.status).toBe(200);

    const confirm = await request(app.getHttpServer())
      .patch(`/api/v1/marketplace/offers/${offer.id}/confirm-advance-received`)
      .set("Authorization", `Bearer ${ctx.token}`)
      .set("X-Profile-Id", ctx.producerProfileId)
      .send({ received: true });
    expect(confirm.status).toBe(200);
    expect(confirm.body.status).toBe("advance_confirmed");

    const listing = await ctx.prisma.marketplaceListing.findUniqueOrThrow({
      where: { id: listingId }
    });
    expect(listing.status).toBe("shipped");
  });

  it("vendeur ne peut pas confirmer solde sans déclaration acheteur", async () => {
    const offer = await ctx.prisma.marketplaceOffer.findFirstOrThrow({
      where: { listingId, status: "advance_confirmed" }
    });
    await ctx.prisma.marketplaceOffer.update({
      where: { id: offer.id },
      data: {
        status: "balance_pending",
        deliveredAt: new Date(),
        balanceDueAt: new Date(Date.now() + 86_400_000)
      }
    });
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/marketplace/offers/${offer.id}/confirm-balance-received`)
      .set("Authorization", `Bearer ${ctx.token}`)
      .set("X-Profile-Id", ctx.producerProfileId)
      .send({ received: true });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it("flux solde : déclaration acheteur et confirmation vendeur", async () => {
    const offer = await ctx.prisma.marketplaceOffer.findFirstOrThrow({
      where: { listingId, status: "balance_pending" }
    });

    const declare = await request(app.getHttpServer())
      .patch(`/api/v1/marketplace/offers/${offer.id}/confirm-balance-paid`)
      .set("Authorization", `Bearer ${ctx.peerToken}`)
      .send({
        amount: Number(offer.balanceAmount),
        paymentMode: "Virement bancaire",
        paymentRef: "VIR-99"
      });
    expect(declare.status).toBe(200);
    expect(declare.body.status).toBe("balance_declared");

    const confirm = await request(app.getHttpServer())
      .patch(`/api/v1/marketplace/offers/${offer.id}/confirm-balance-received`)
      .set("Authorization", `Bearer ${ctx.token}`)
      .set("X-Profile-Id", ctx.producerProfileId)
      .send({ received: true });
    expect(confirm.status).toBe(200);
    expect(confirm.body.status).toBe("completed");

    const score = await request(app.getHttpServer())
      .get("/api/v1/marketplace/buyers/me/credit-score")
      .set("Authorization", `Bearer ${ctx.peerToken}`);
    expect(score.status).toBe(200);
    expect(score.body.creditTransactionsCount).toBeGreaterThanOrEqual(1);
  });

  it("refuse avance 100% (solde nul)", async () => {
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
    const extra = await request(app.getHttpServer())
      .post("/api/v1/marketplace/listings")
      .set("Authorization", `Bearer ${ctx.token}`)
      .set("X-Profile-Id", ctx.producerProfileId)
      .send({
        title: "Charcutier solde nul",
        farmId: ctx.farmId,
        animalId: animal.id,
        category: "butcher",
        totalPrice: 80_000,
        totalWeightKg: 60
      });
    await request(app.getHttpServer())
      .post(`/api/v1/marketplace/listings/${extra.body.id}/publish`)
      .set("Authorization", `Bearer ${ctx.token}`)
      .set("X-Profile-Id", ctx.producerProfileId)
      .send({ durationDays: 14 });
    const res = await request(app.getHttpServer())
      .post(`/api/v1/marketplace/listings/${extra.body.id}/offers/credit`)
      .set("Authorization", `Bearer ${ctx.peerToken}`)
      .send({
        offeredPrice: 80_000,
        advancePercentage: 50,
        balanceDueDays: 1
      });
    expect(res.status).toBeGreaterThanOrEqual(200);
    if (res.status < 400) {
      const bad = await request(app.getHttpServer())
        .patch(
          `/api/v1/marketplace/listings/${extra.body.id}/offers/${res.body.id}/counter-credit`
        )
        .set("Authorization", `Bearer ${ctx.token}`)
        .set("X-Profile-Id", ctx.producerProfileId)
        .send({
          offeredPrice: 80_000,
          advancePercentage: 100,
          balanceDueDays: 1
        });
      expect(bad.status).toBeGreaterThanOrEqual(400);
    }
  });
});
