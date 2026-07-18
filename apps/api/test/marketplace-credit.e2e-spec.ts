import type { NestExpressApplication } from "@nestjs/platform-express";
import { AnimalSex, PrismaClient } from "@prisma/client";
import request from "supertest";
import { createTestApp } from "./helpers/create-test-app";
import {
  advanceMarketplaceToSellerShipped,
  confirmMarketplacePayment
} from "./helpers/marketplace-delivery-e2e";
import {
  cleanupE2eFixtures,
  seedE2eFixtures,
  type E2ESeedResult
} from "./helpers/e2e-seed";

const hasDb = Boolean(process.env.DATABASE_URL?.trim());
const hasJwt = Boolean(process.env.SUPABASE_JWT_SECRET?.trim());
const describeOrSkip = hasDb && hasJwt ? describe : describe.skip;

describeOrSkip("Marketplace vente à crédit escrow (e2e)", () => {
  let app: NestExpressApplication;
  let ctx: E2ESeedResult;
  let listingId: string;
  let offerId: string;
  let transactionId: string;
  let animalId: string;

  beforeAll(async () => {
    process.env.THROTTLE_LIMIT = "100000";
    process.env.MOBILE_MONEY_PROVIDER = "dev";
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
    animalId = animal.id;

    const listingRes = await request(app.getHttpServer())
      .post("/api/v1/marketplace/listings")
      .set("Authorization", `Bearer ${ctx.token}`)
      .set("X-Profile-Id", ctx.producerProfileId)
      .send({
        title: "E2E charcutier crédit escrow",
        farmId: ctx.farmId,
        animalId: animal.id,
        category: "butcher",
        pricePerKg: 1_250,
        totalPrice: 100_000,
        totalWeightKg: 80,
        weightBasis: "live"
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
        unitPrice: 50_000
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
        balanceDueDays: 7
      });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it("refuse crédit sans opt-in vendeur", async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/marketplace/listings/${listingId}/offers/credit`)
      .set("Authorization", `Bearer ${ctx.peerToken}`)
      .send({
        offeredPrice: 100_000,
        advancePercentage: 30,
        balanceDueDays: 7
      });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it("active crédit sur annonce charcutier", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/marketplace/listings/${listingId}`)
      .set("Authorization", `Bearer ${ctx.token}`)
      .set("X-Profile-Id", ctx.producerProfileId)
      .send({ creditEnabled: true });
    expect(res.status).toBe(200);
    expect(res.body.creditEnabled).toBe(true);
  });

  it("accord crédit crée transaction escrow avance", async () => {
    const create = await request(app.getHttpServer())
      .post(`/api/v1/marketplace/listings/${listingId}/offers/credit`)
      .set("Authorization", `Bearer ${ctx.peerToken}`)
      .send({
        offeredPrice: 100_000,
        advancePercentage: 30,
        balanceDueDays: 7,
        message: "Revendeur E2E escrow"
      });
    expect([200, 201]).toContain(create.status);
    offerId = create.body.id;

    const agree = await request(app.getHttpServer())
      .patch(
        `/api/v1/marketplace/listings/${listingId}/offers/${offerId}/agree-credit`
      )
      .set("Authorization", `Bearer ${ctx.token}`)
      .set("X-Profile-Id", ctx.producerProfileId);
    expect(agree.status).toBe(200);
    expect(agree.body.status).toBe("credit_agreed");
    expect(agree.body.transactionId).toBeTruthy();
    transactionId = agree.body.transactionId;

    const listingAfterAgree = await ctx.prisma.marketplaceListing.findUniqueOrThrow({
      where: { id: listingId }
    });
    expect(listingAfterAgree.status).toBe("published");
    expect(listingAfterAgree.reservedForBuyerUserId).toBe(ctx.peerUserId);

    const tx = await request(app.getHttpServer())
      .get(`/api/v1/marketplace/transactions/${transactionId}`)
      .set("Authorization", `Bearer ${ctx.peerToken}`);
    expect(tx.body.status).toBe("PAYMENT_PENDING");
    expect(tx.body.isCredit).toBe(true);
    expect(Number(tx.body.blockedAmount)).toBe(30_000);
  });

  it("refuse déclaration avance hors escrow", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/marketplace/offers/${offerId}/confirm-advance-paid`)
      .set("Authorization", `Bearer ${ctx.peerToken}`)
      .send({ paymentMode: "Espèces" });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it("avance payée via escrow puis livraison et solde recalculé", async () => {
    await confirmMarketplacePayment({
      app,
      buyerToken: ctx.peerToken,
      transactionId
    });

    const offerAfterPay = await ctx.prisma.marketplaceOffer.findUniqueOrThrow({
      where: { id: offerId }
    });
    expect(offerAfterPay.status).toBe("advance_confirmed");

    await advanceMarketplaceToSellerShipped({
      app,
      sellerToken: ctx.token,
      buyerToken: ctx.peerToken,
      transactionId,
      animalId,
      animalWeightKg: 80
    });

    const offerBalanced = await ctx.prisma.marketplaceOffer.findUniqueOrThrow({
      where: { id: offerId }
    });
    expect(offerBalanced.status).toBe("balance_pending");
    expect(Number(offerBalanced.balanceAmount)).toBe(70_000);
    expect(offerBalanced.balanceDueAt).toBeTruthy();
  });

  it("solde payé via escrow et clôture vendeur", async () => {
    const initBal = await request(app.getHttpServer())
      .post(`/api/v1/marketplace/offers/${offerId}/balance-payment/initiate`)
      .set("Authorization", `Bearer ${ctx.peerToken}`)
      .send({ paymentMethod: "mobile_money" });
    expect(initBal.status).toBe(201);

    const confirmBal = await request(app.getHttpServer())
      .patch(`/api/v1/marketplace/offers/${offerId}/balance-payment/confirm`)
      .set("Authorization", `Bearer ${ctx.peerToken}`)
      .send({ providerRef: initBal.body.providerRef });
    expect(confirmBal.status).toBe(200);
    expect(confirmBal.body.status).toBe("balance_declared");

    const close = await request(app.getHttpServer())
      .patch(`/api/v1/marketplace/offers/${offerId}/confirm-balance-received`)
      .set("Authorization", `Bearer ${ctx.token}`)
      .set("X-Profile-Id", ctx.producerProfileId)
      .send({ received: true });
    expect(close.status).toBe(200);
    expect(close.body.status).toBe("completed");

    const txClosed = await ctx.prisma.marketplaceTransaction.findUniqueOrThrow({
      where: { id: transactionId }
    });
    expect(txClosed.status).toBe("TRANSACTION_CLOSED");
  });
});
