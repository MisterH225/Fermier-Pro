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
  advanceMarketplaceToSellerShipped,
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
      await ctx.prisma.marketplaceTransactionReceipt.deleteMany({
        where: { transaction: { buyerUserId: ctx.peerUserId } }
      });
      await ctx.prisma.platformRevenue.deleteMany({
        where: { buyerId: ctx.peerUserId }
      });
      await ctx.prisma.marketplaceFundMovement.deleteMany({
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

    await advanceMarketplaceToSellerShipped({
      app,
      sellerToken: ctx.token,
      buyerToken: ctx.peerToken,
      transactionId: disputeListing.transactionId
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

    await advanceMarketplaceToSellerShipped({
      app,
      sellerToken: ctx.token,
      buyerToken: ctx.peerToken,
      transactionId: reminderListing.transactionId
    });

    const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);
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

    await advanceMarketplaceToSellerShipped({
      app,
      sellerToken: ctx.token,
      buyerToken: ctx.peerToken,
      transactionId: autoListing.transactionId
    });

    const fifteenDaysAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
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

  it("annulation par l'acheteur : offre → cancelled, transaction → CANCELLED_BY_BUYER, annonce → published", async () => {
    const cancelListing = await setupMarketplaceDeliveryListing({
      app,
      prisma: ctx.prisma,
      sellerToken: ctx.token,
      sellerProfileId: ctx.producerProfileId,
      sellerFarmId: ctx.farmId,
      buyerToken: ctx.peerToken,
      buyerFarmId
    });

    // Annulation depuis PAYMENT_PENDING (avant paiement)
    const cancelRes = await request(app.getHttpServer())
      .post(`/api/v1/marketplace/transactions/${cancelListing.transactionId}/cancel`)
      .set("Authorization", `Bearer ${ctx.peerToken}`);
    expect(cancelRes.status).toBe(201);
    expect(cancelRes.body.ok).toBe(true);

    // La transaction doit être CANCELLED_BY_BUYER
    const txAfter = await ctx.prisma.marketplaceTransaction.findUniqueOrThrow({
      where: { id: cancelListing.transactionId }
    });
    expect(txAfter.status).toBe("CANCELLED_BY_BUYER");

    // L'offre doit être cancelled (c'est le bug corrigé)
    const offerAfter = await ctx.prisma.marketplaceOffer.findUniqueOrThrow({
      where: { id: cancelListing.offerId }
    });
    expect(offerAfter.status).toBe("cancelled");

    // L'annonce doit être re-publiée
    const listingAfter = await ctx.prisma.marketplaceListing.findUniqueOrThrow({
      where: { id: cancelListing.listingId }
    });
    expect(listingAfter.status).toBe("published");
    expect(listingAfter.reservedForBuyerUserId).toBeNull();
  });

  it("annulation par l'acheteur après paiement : offre → cancelled, remboursement effectué", async () => {
    const cancelPaidListing = await setupMarketplaceDeliveryListing({
      app,
      prisma: ctx.prisma,
      sellerToken: ctx.token,
      sellerProfileId: ctx.producerProfileId,
      sellerFarmId: ctx.farmId,
      buyerToken: ctx.peerToken,
      buyerFarmId
    });

    // Paiement
    const payInit = await request(app.getHttpServer())
      .post(`/api/v1/marketplace/transactions/${cancelPaidListing.transactionId}/payment/initiate`)
      .set("Authorization", `Bearer ${ctx.peerToken}`);
    expect(payInit.status).toBe(201);
    await request(app.getHttpServer())
      .post(`/api/v1/marketplace/transactions/${cancelPaidListing.transactionId}/payment/confirm`)
      .set("Authorization", `Bearer ${ctx.peerToken}`)
      .send({ providerRef: payInit.body.providerRef });

    // Annulation depuis PAYMENT_HELD
    const cancelRes = await request(app.getHttpServer())
      .post(`/api/v1/marketplace/transactions/${cancelPaidListing.transactionId}/cancel`)
      .set("Authorization", `Bearer ${ctx.peerToken}`);
    expect(cancelRes.status).toBe(201);

    // L'offre doit être cancelled
    const offerAfter = await ctx.prisma.marketplaceOffer.findUniqueOrThrow({
      where: { id: cancelPaidListing.offerId }
    });
    expect(offerAfter.status).toBe("cancelled");

    // La transaction doit être CANCELLED_BY_BUYER
    const txAfter = await ctx.prisma.marketplaceTransaction.findUniqueOrThrow({
      where: { id: cancelPaidListing.transactionId }
    });
    expect(txAfter.status).toBe("CANCELLED_BY_BUYER");

    // L'annonce doit être re-publiée
    const listingAfter = await ctx.prisma.marketplaceListing.findUniqueOrThrow({
      where: { id: cancelPaidListing.listingId }
    });
    expect(listingAfter.status).toBe("published");
  });

  it("frais plateforme : blockedAmount inclut la commission, vendeur reçoit le prix total", async () => {
    const feeListing = await setupMarketplaceDeliveryListing({
      app,
      prisma: ctx.prisma,
      sellerToken: ctx.token,
      sellerProfileId: ctx.producerProfileId,
      sellerFarmId: ctx.farmId,
      buyerToken: ctx.peerToken,
      buyerFarmId
    });

    // Récupérer la transaction via l'API
    const txRes = await request(app.getHttpServer())
      .get(`/api/v1/marketplace/transactions/${feeListing.transactionId}`)
      .set("Authorization", `Bearer ${ctx.peerToken}`);
    expect(txRes.status).toBe(200);
    const tx = txRes.body;

    // La transaction doit être marquée buyerPaysCommission
    expect(tx.buyerPaysCommission).toBe(true);
    expect(tx.commissionRate).toBeGreaterThan(0);

    // blockedAmount correct :
    // Flat  : agreedFlatPrice × (1 + commissionRate)
    // Per_kg: agreedDeal × (PAYMENT_BUFFER + commissionRate)
    //         = agreedDeal × (1.1 + rate)   — commission sur le prix convenu, buffer séparé
    const isFlat = tx.priceType === "flat";
    if (isFlat) {
      const expectedBlocked = Math.round((tx.agreedFlatPrice ?? 0) * (1 + tx.commissionRate));
      expect(tx.blockedAmount).toBe(expectedBlocked);
    } else {
      const agreedDeal = (tx.agreedPricePerKg ?? 0) * (tx.estimatedWeightKg ?? 0);
      const expectedBlocked = Math.round(agreedDeal * (1.1 + tx.commissionRate));
      expect(tx.blockedAmount).toBe(expectedBlocked);
    }

    // platformFeeEstimate = dealPrice (sans buffer) × commissionRate
    const estimatedDeal = isFlat
      ? (tx.agreedFlatPrice ?? 0)
      : (tx.agreedPricePerKg ?? 0) * (tx.estimatedWeightKg ?? 0);
    const expectedFee = Math.round(estimatedDeal * tx.commissionRate);
    expect(tx.platformFeeEstimate).toBe(expectedFee);

    // Vérifier en base que buyerPaysCommission est bien true
    const txDb = await ctx.prisma.marketplaceTransaction.findUniqueOrThrow({
      where: { id: feeListing.transactionId }
    });
    expect(txDb.buyerPaysCommission).toBe(true);

    // Effectuer le cycle complet et vérifier que le vendeur reçoit le prix total (sans déduction)
    const payInit = await request(app.getHttpServer())
      .post(`/api/v1/marketplace/transactions/${feeListing.transactionId}/payment/initiate`)
      .set("Authorization", `Bearer ${ctx.peerToken}`);
    expect(payInit.status).toBe(201);
    // Le montant de paiement inclut la commission
    expect(payInit.body.amount).toBe(tx.blockedAmount);

    await request(app.getHttpServer())
      .post(`/api/v1/marketplace/transactions/${feeListing.transactionId}/payment/confirm`)
      .set("Authorization", `Bearer ${ctx.peerToken}`)
      .send({ providerRef: payInit.body.providerRef });

    await import("./helpers/marketplace-delivery-e2e").then(({ advanceMarketplaceToSellerShipped }) =>
      advanceMarketplaceToSellerShipped({
        app,
        sellerToken: ctx.token,
        buyerToken: ctx.peerToken,
        transactionId: feeListing.transactionId
      })
    );

    await request(app.getHttpServer())
      .post(`/api/v1/marketplace/transactions/${feeListing.transactionId}/confirm-receipt`)
      .set("Authorization", `Bearer ${ctx.peerToken}`)
      .send({
        receivedAt: new Date().toISOString().slice(0, 10),
        condition: "conform",
        receivedAnimalIds: [feeListing.animalId]
      });

    // Après clôture, vérifier les montants de commission
    const closedTx = await ctx.prisma.marketplaceTransaction.findUniqueOrThrow({
      where: { id: feeListing.transactionId }
    });
    expect(closedTx.status).toBe("TRANSACTION_CLOSED");
    const finalAmt = Number(closedTx.finalAmount ?? 0);
    const buyerRate = Number(closedTx.commissionRate);
    const sellerRate = Number(closedTx.sellerCommissionRate ?? 0);

    // commissionAmount (acheteur) = finalAmount × commissionRate
    const commissionAmt = Number(closedTx.commissionAmount ?? 0);
    expect(commissionAmt).toBe(Math.round(finalAmt * buyerRate));

    // sellerCommissionAmount = finalAmount × sellerCommissionRate
    const sellerCommAmt = Number(closedTx.sellerCommissionAmount ?? 0);
    expect(sellerCommAmt).toBe(Math.round(finalAmt * sellerRate));

    // sellerReceivedAmount = finalAmount - sellerCommission
    const sellerAmt = Number(closedTx.sellerReceivedAmount ?? 0);
    expect(sellerAmt).toBe(finalAmt - sellerCommAmt);
  });
});
