import type { NestExpressApplication } from "@nestjs/platform-express";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { MarketplaceTransactionService } from "../src/marketplace/escrow/marketplace-transaction.service";
import { createTestApp } from "./helpers/create-test-app";
import {
  cleanupE2eFixtures,
  seedE2eFixtures,
  type E2ESeedResult
} from "./helpers/e2e-seed";
import {
  runDoubleConfirmationHappyPath,
  seedBuyerFarm,
  setupMarketplaceDeliveryListing,
  type MarketplaceDeliveryCtx
} from "./helpers/marketplace-delivery-e2e";

const hasDb = Boolean(process.env.DATABASE_URL?.trim());
const hasJwt = Boolean(process.env.SUPABASE_JWT_SECRET?.trim());
const describeOrSkip = hasDb && hasJwt ? describe : describe.skip;

describeOrSkip("Marketplace livraison double confirmation (e2e)", () => {
  let app: NestExpressApplication;
  let ctx: E2ESeedResult;
  let buyerFarmId: string;
  let deliveryCtx: MarketplaceDeliveryCtx;

  beforeAll(async () => {
    process.env.THROTTLE_LIMIT = "100000";
    ctx = await seedE2eFixtures(PrismaClient);
    buyerFarmId = await seedBuyerFarm(ctx.prisma, ctx.peerUserId);
    app = await createTestApp();
    deliveryCtx = await setupMarketplaceDeliveryListing({
      app,
      prisma: ctx.prisma,
      sellerToken: ctx.token,
      sellerProfileId: ctx.producerProfileId,
      sellerFarmId: ctx.farmId,
      buyerToken: ctx.peerToken,
      buyerFarmId
    });
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (ctx?.prisma) {
      await ctx.prisma.marketplacePendingTransfer.deleteMany({
        where: { buyerUserId: ctx.peerUserId }
      });
      await ctx.prisma.marketplaceDeliveryDispute.deleteMany({
        where: { transaction: { buyerUserId: ctx.peerUserId } }
      });
      await ctx.prisma.marketplaceTransaction.deleteMany({
        where: { buyerUserId: ctx.peerUserId }
      });
      await ctx.prisma.farm.deleteMany({ where: { ownerId: ctx.peerUserId } });
      await cleanupE2eFixtures(ctx.prisma, {
        farmId: ctx.farmId,
        userId: ctx.userId,
        peerUserId: ctx.peerUserId
      });
    }
  });

  it("happy path : paiement → envoi → réception → poids → clôture + pending transfer", async () => {
    await runDoubleConfirmationHappyPath({
      app,
      sellerToken: ctx.token,
      buyerToken: ctx.peerToken,
      ctx: deliveryCtx
    });

    const complete = await request(app.getHttpServer())
      .post(
        `/api/v1/marketplace/transactions/${deliveryCtx.transactionId}/pending-transfer/complete`
      )
      .set("Authorization", `Bearer ${ctx.peerToken}`)
      .send({ buyerFarmId });
    expect(complete.status).toBe(201);
    expect(complete.body.ok).toBe(true);
    expect(complete.body.animalIds?.length).toBeGreaterThan(0);

    const imported = await ctx.prisma.animal.findMany({
      where: { farmId: buyerFarmId, id: { in: complete.body.animalIds } }
    });
    expect(imported.length).toBe(complete.body.animalIds.length);
  });

  it("litige livraison : ouverture puis résolution admin en faveur du vendeur", async () => {
    const disputeListing = await setupMarketplaceDeliveryListing({
      app,
      prisma: ctx.prisma,
      sellerToken: ctx.token,
      sellerProfileId: ctx.producerProfileId,
      sellerFarmId: ctx.farmId,
      buyerToken: ctx.peerToken,
      buyerFarmId
    });

    const payInit = await request(app.getHttpServer())
      .post(
        `/api/v1/marketplace/transactions/${disputeListing.transactionId}/payment/initiate`
      )
      .set("Authorization", `Bearer ${ctx.peerToken}`);
    const providerRef = payInit.body.providerRef as string;
    await request(app.getHttpServer())
      .post(
        `/api/v1/marketplace/transactions/${disputeListing.transactionId}/payment/confirm`
      )
      .set("Authorization", `Bearer ${ctx.peerToken}`)
      .send({ providerRef });

    await request(app.getHttpServer())
      .post(
        `/api/v1/marketplace/transactions/${disputeListing.transactionId}/confirm-shipment`
      )
      .set("Authorization", `Bearer ${ctx.token}`)
      .send({
        shippedAt: new Date().toISOString().slice(0, 10),
        method: "handover"
      });

    const openDispute = await request(app.getHttpServer())
      .post(
        `/api/v1/marketplace/transactions/${disputeListing.transactionId}/delivery-dispute`
      )
      .set("Authorization", `Bearer ${ctx.peerToken}`)
      .send({
        disputeType: "Animal manquant",
        description: "E2E litige livraison"
      });
    expect(openDispute.status).toBe(201);
    expect(openDispute.body.status).toBe("DELIVERY_DISPUTED");

    const dispute = await ctx.prisma.marketplaceDeliveryDispute.findFirst({
      where: { transactionId: disputeListing.transactionId }
    });
    expect(dispute).toBeTruthy();

    await ctx.prisma.superAdmin.upsert({
      where: { userId: ctx.userId },
      create: { userId: ctx.userId },
      update: {}
    });

    const resolve = await request(app.getHttpServer())
      .patch(`/api/v1/marketplace/disputes/${dispute!.id}/resolve`)
      .set("Authorization", `Bearer ${ctx.token}`)
      .send({ outcome: "resolved_vendor", notes: "E2E arbitrage vendeur" });
    expect(resolve.status).toBe(200);
    expect(resolve.body.ok).toBe(true);

    const txAfter = await request(app.getHttpServer())
      .get(
        `/api/v1/marketplace/transactions/${disputeListing.transactionId}`
      )
      .set("Authorization", `Bearer ${ctx.peerToken}`);
    expect(txAfter.body.status).toBe("BUYER_RECEIVED");
  });

  it("rappels livraison et litige auto après délai", async () => {
    const reminderListing = await setupMarketplaceDeliveryListing({
      app,
      prisma: ctx.prisma,
      sellerToken: ctx.token,
      sellerProfileId: ctx.producerProfileId,
      sellerFarmId: ctx.farmId,
      buyerToken: ctx.peerToken,
      buyerFarmId
    });

    const payInit = await request(app.getHttpServer())
      .post(
        `/api/v1/marketplace/transactions/${reminderListing.transactionId}/payment/initiate`
      )
      .set("Authorization", `Bearer ${ctx.peerToken}`);
    await request(app.getHttpServer())
      .post(
        `/api/v1/marketplace/transactions/${reminderListing.transactionId}/payment/confirm`
      )
      .set("Authorization", `Bearer ${ctx.peerToken}`)
      .send({ providerRef: payInit.body.providerRef });

    const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);
    await request(app.getHttpServer())
      .post(
        `/api/v1/marketplace/transactions/${reminderListing.transactionId}/confirm-shipment`
      )
      .set("Authorization", `Bearer ${ctx.token}`)
      .send({
        shippedAt: fourDaysAgo.toISOString().slice(0, 10),
        method: "handover"
      });

    await ctx.prisma.marketplaceTransaction.update({
      where: { id: reminderListing.transactionId },
      data: { sellerShippedAt: fourDaysAgo }
    });

    const txService = app.get(MarketplaceTransactionService);
    const reminders = await txService.handleDeliveryReminders();
    expect(reminders.buyer).toBeGreaterThanOrEqual(1);

    const autoListing = await setupMarketplaceDeliveryListing({
      app,
      prisma: ctx.prisma,
      sellerToken: ctx.token,
      sellerProfileId: ctx.producerProfileId,
      sellerFarmId: ctx.farmId,
      buyerToken: ctx.peerToken,
      buyerFarmId
    });

    const autoPayInit = await request(app.getHttpServer())
      .post(
        `/api/v1/marketplace/transactions/${autoListing.transactionId}/payment/initiate`
      )
      .set("Authorization", `Bearer ${ctx.peerToken}`);
    await request(app.getHttpServer())
      .post(
        `/api/v1/marketplace/transactions/${autoListing.transactionId}/payment/confirm`
      )
      .set("Authorization", `Bearer ${ctx.peerToken}`)
      .send({ providerRef: autoPayInit.body.providerRef });

    const fifteenDaysAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
    await request(app.getHttpServer())
      .post(
        `/api/v1/marketplace/transactions/${autoListing.transactionId}/confirm-shipment`
      )
      .set("Authorization", `Bearer ${ctx.token}`)
      .send({
        shippedAt: fifteenDaysAgo.toISOString().slice(0, 10),
        method: "handover"
      });
    await ctx.prisma.marketplaceTransaction.update({
      where: { id: autoListing.transactionId },
      data: { sellerShippedAt: fifteenDaysAgo }
    });

    const autoCount = await txService.handleAutoDeliveryDisputes();
    expect(autoCount).toBeGreaterThanOrEqual(1);

    const autoDispute = await ctx.prisma.marketplaceDeliveryDispute.findFirst({
      where: { transactionId: autoListing.transactionId }
    });
    expect(autoDispute?.disputeType).toBe("Délai dépassé");
  });
});
