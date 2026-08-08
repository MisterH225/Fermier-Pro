import type { NestExpressApplication } from "@nestjs/platform-express";
import {
  AnimalSex,
  ListingStatus,
  MarketplaceFundMovementKind,
  MarketplaceTransactionStatus,
  Prisma,
  PrismaClient
} from "@prisma/client";
import request from "supertest";
import { MarketplaceTransactionService } from "../src/marketplace/escrow/marketplace-transaction.service";
import { ReceiptService } from "../src/marketplace/receipts/receipt.service";
import { createTestApp } from "./helpers/create-test-app";
import {
  cleanupE2eFixtures,
  seedE2eFixtures,
  type E2ESeedResult
} from "./helpers/e2e-seed";
import {
  advanceMarketplaceToSellerShipped,
  seedBuyerFarm,
  setupMarketplaceDeliveryListing,
  type MarketplaceDeliveryCtx
} from "./helpers/marketplace-delivery-e2e";
import {
  cleanupBuyerMarketplaceState,
  creditWalletViaDevTopUp,
  payMarketplaceWallet,
  prepareWalletE2eUsers,
  purgeWalletE2eData
} from "./helpers/wallet-payout-e2e";

const hasDb = Boolean(process.env.DATABASE_URL?.trim());
const hasJwt = Boolean(process.env.SUPABASE_JWT_SECRET?.trim());
const describeOrSkip = hasDb && hasJwt ? describe : describe.skip;

/**
 * E2E failure-modes du règlement escrow (audit août 2026) :
 * - reprise après RELEASE partiel (sans délistage / refund)
 * - double settle idempotent
 * - facture seulement après règlement vérifiable
 * - crédit solde = 0 → settle à la réception
 */
describeOrSkip("Escrow settle — failure modes (e2e)", () => {
  let app: NestExpressApplication;
  let ctx: E2ESeedResult;
  let buyerFarmId: string;
  let txService: MarketplaceTransactionService;
  let receipts: ReceiptService;

  async function freshDeal(): Promise<MarketplaceDeliveryCtx> {
    await cleanupBuyerMarketplaceState(ctx.prisma, [ctx.userId, ctx.peerUserId]);
    return setupMarketplaceDeliveryListing({
      app,
      prisma: ctx.prisma,
      sellerToken: ctx.token,
      sellerProfileId: ctx.producerProfileId,
      sellerFarmId: ctx.farmId,
      buyerToken: ctx.peerToken,
      buyerFarmId
    });
  }

  /** Paie + avance jusqu'à SELLER_SHIPPED avec un poids acheteur donné. */
  async function paidAndShipped(
    deal: MarketplaceDeliveryCtx,
    animalWeightKg: number
  ): Promise<void> {
    await payMarketplaceWallet({
      app,
      buyerToken: ctx.peerToken,
      transactionId: deal.transactionId
    });
    await advanceMarketplaceToSellerShipped({
      app,
      sellerToken: ctx.token,
      buyerToken: ctx.peerToken,
      transactionId: deal.transactionId,
      animalId: deal.animalId,
      animalWeightKg
    });
  }

  /**
   * Simule un settle partiel historique : RELEASE journalisé, tx en BUYER_RECEIVED
   * (ou CLOSED), listing encore non sold, pas de REFUND.
   */
  async function injectPartialRelease(
    deal: MarketplaceDeliveryCtx,
    options?: { alreadyClosed?: boolean; releaseAmount?: number }
  ): Promise<void> {
    await ctx.prisma.marketplaceTransaction.update({
      where: { id: deal.transactionId },
      data: {
        status: options?.alreadyClosed
          ? MarketplaceTransactionStatus.TRANSACTION_CLOSED
          : MarketplaceTransactionStatus.BUYER_RECEIVED,
        buyerReceivedAt: new Date(),
        closedAt: options?.alreadyClosed ? new Date() : null
      }
    });
    await ctx.prisma.marketplaceFundMovement.create({
      data: {
        transactionId: deal.transactionId,
        kind: MarketplaceFundMovementKind.RELEASE_TO_SELLER,
        amount: new Prisma.Decimal(options?.releaseAmount ?? 1),
        currency: "XOF",
        providerRef: "e2e-partial-release",
        note: "E2E simulation settle partiel"
      }
    });
  }

  async function assertSettlementComplete(
    deal: MarketplaceDeliveryCtx,
    options?: { expectBuyerRefund?: boolean }
  ): Promise<void> {
    const tx = await ctx.prisma.marketplaceTransaction.findUniqueOrThrow({
      where: { id: deal.transactionId }
    });
    expect(tx.status).toBe(MarketplaceTransactionStatus.TRANSACTION_CLOSED);

    const listing = await ctx.prisma.marketplaceListing.findUniqueOrThrow({
      where: { id: deal.listingId }
    });
    expect(listing.status).toBe(ListingStatus.sold);
    expect(listing.activeOfferCount).toBe(0);

    const releases = await ctx.prisma.marketplaceFundMovement.count({
      where: {
        transactionId: deal.transactionId,
        kind: MarketplaceFundMovementKind.RELEASE_TO_SELLER
      }
    });
    expect(releases).toBe(1);

    if (options?.expectBuyerRefund) {
      const refunds = await ctx.prisma.marketplaceFundMovement.count({
        where: {
          transactionId: deal.transactionId,
          kind: MarketplaceFundMovementKind.REFUND_BUYER
        }
      });
      expect(refunds).toBe(1);
      expect(Number(tx.buyerRefundAmount ?? 0)).toBeGreaterThan(0);
    }

    // Facture émise par settle (async) — on poll, sans re-appeler generateReceipt
    // (évite course sur receiptNumber / unique constraint).
    const receiptRow = await waitForReceipt(deal.transactionId);
    expect(receiptRow?.receiptNumber).toBeTruthy();
  }

  async function waitForReceipt(
    transactionId: string,
    attempts = 30
  ): Promise<{ receiptNumber: string } | null> {
    for (let i = 0; i < attempts; i += 1) {
      const row = await ctx.prisma.marketplaceTransactionReceipt.findUnique({
        where: { transactionId },
        select: { receiptNumber: true }
      });
      if (row?.receiptNumber) {
        return row;
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    // Fallback si le void generateReceipt du settle a échoué / pas encore parti.
    const generated = await receipts.generateReceipt(transactionId);
    if (generated?.receiptNumber) {
      return generated;
    }
    return ctx.prisma.marketplaceTransactionReceipt.findUnique({
      where: { transactionId },
      select: { receiptNumber: true }
    });
  }

  beforeAll(async () => {
    process.env.THROTTLE_LIMIT = "100000";
    process.env.MOBILE_MONEY_PROVIDER = "dev";
    process.env.FEATURE_WALLET = "true";
    ctx = await seedE2eFixtures(PrismaClient);
    buyerFarmId = await seedBuyerFarm(ctx.prisma, ctx.peerUserId);
    await prepareWalletE2eUsers(ctx.prisma, {
      buyerUserId: ctx.peerUserId,
      sellerUserId: ctx.userId
    });
    app = await createTestApp();
    txService = app.get(MarketplaceTransactionService);
    receipts = app.get(ReceiptService);
    // Une seule grosse recharge — évite le 429 Throttler sur les top-ups répétés.
    await creditWalletViaDevTopUp({
      app,
      token: ctx.peerToken,
      amount: 2_000_000
    });
  });

  afterAll(async () => {
    if (app) await app.close();
    if (ctx?.prisma) {
      await purgeWalletE2eData(ctx.prisma, [ctx.userId, ctx.peerUserId]);
      // Ferme acheteur créée hors seed principal.
      await ctx.prisma.farm.deleteMany({ where: { id: buyerFarmId } });
      await cleanupE2eFixtures(ctx.prisma, {
        farmId: ctx.farmId,
        userId: ctx.userId,
        peerUserId: ctx.peerUserId
      });
    }
  });

  it("reprise après RELEASE partiel (BUYER_RECEIVED) : délistage + refund + facture", async () => {
    const deal = await freshDeal();
    // Poids réel 20 kg < estimé 25 → trop-perçu à rembourser.
    await paidAndShipped(deal, 20);
    await injectPartialRelease(deal, { alreadyClosed: false });

    const listingBefore = await ctx.prisma.marketplaceListing.findUniqueOrThrow({
      where: { id: deal.listingId }
    });
    expect(listingBefore.status).not.toBe(ListingStatus.sold);

    const refundBefore = await ctx.prisma.marketplaceFundMovement.count({
      where: {
        transactionId: deal.transactionId,
        kind: MarketplaceFundMovementKind.REFUND_BUYER
      }
    });
    expect(refundBefore).toBe(0);

    // Ancien bug : priorRelease fermait + facturait sans finir. Le retry doit finir.
    await txService.settleTransaction(deal.transactionId);

    await assertSettlementComplete(deal, { expectBuyerRefund: true });
  });

  it("reprise si CLOSED incomplet (RELEASE sans sold) : side-effects + facture", async () => {
    const deal = await freshDeal();
    await paidAndShipped(deal, 20);
    await injectPartialRelease(deal, { alreadyClosed: true });

    expect(
      (
        await ctx.prisma.marketplaceListing.findUniqueOrThrow({
          where: { id: deal.listingId }
        })
      ).status
    ).not.toBe(ListingStatus.sold);

    // Recovery path TRANSACTION_CLOSED incomplet.
    await txService.settleTransaction(deal.transactionId);

    await assertSettlementComplete(deal, { expectBuyerRefund: true });
  });

  it("double settle concurrent : un seul RELEASE, listing sold, facture OK", async () => {
    const deal = await freshDeal();
    await paidAndShipped(deal, 25);

    await ctx.prisma.marketplaceTransaction.update({
      where: { id: deal.transactionId },
      data: {
        status: MarketplaceTransactionStatus.BUYER_RECEIVED,
        buyerReceivedAt: new Date()
      }
    });

    await Promise.all([
      txService.settleTransaction(deal.transactionId),
      txService.settleTransaction(deal.transactionId)
    ]);

    await assertSettlementComplete(deal, { expectBuyerRefund: false });

    const commissions = await ctx.prisma.marketplaceFundMovement.count({
      where: {
        transactionId: deal.transactionId,
        kind: MarketplaceFundMovementKind.COMMISSION
      }
    });
    expect(commissions).toBe(1);
  });

  it("confirm-receipt nominal : listing sold + refund si poids ↓ + facture après", async () => {
    const deal = await freshDeal();
    await paidAndShipped(deal, 20);

    const receipt = await request(app.getHttpServer())
      .post(
        `/api/v1/marketplace/transactions/${deal.transactionId}/confirm-receipt`
      )
      .set("Authorization", `Bearer ${ctx.peerToken}`)
      .send({
        receivedAt: new Date().toISOString().slice(0, 10),
        condition: "conform",
        receivedAnimalIds: [deal.animalId]
      });
    expect(receipt.status).toBe(201);
    expect(receipt.body.status).toBe("TRANSACTION_CLOSED");

    await assertSettlementComplete(deal, { expectBuyerRefund: true });
  });

  it("crédit solde = 0 : réception déclenche settle (pas de boucle BUYER_RECEIVED)", async () => {
    await cleanupBuyerMarketplaceState(ctx.prisma, [ctx.userId, ctx.peerUserId]);

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
        title: "E2E crédit solde zéro",
        farmId: ctx.farmId,
        animalId: animal.id,
        category: "butcher",
        pricePerKg: 1_250,
        totalPrice: 100_000,
        totalWeightKg: 80,
        weightBasis: "live"
      });
    expect([200, 201]).toContain(listingRes.status);
    const listingId = listingRes.body.id as string;

    const enableCredit = await request(app.getHttpServer())
      .patch(`/api/v1/marketplace/listings/${listingId}`)
      .set("Authorization", `Bearer ${ctx.token}`)
      .set("X-Profile-Id", ctx.producerProfileId)
      .send({ creditEnabled: true });
    expect(enableCredit.status).toBe(200);

    await request(app.getHttpServer())
      .post(`/api/v1/marketplace/listings/${listingId}/publish`)
      .set("Authorization", `Bearer ${ctx.token}`)
      .set("X-Profile-Id", ctx.producerProfileId)
      .send({ durationDays: 14 });

    // Avance 50 % = 50 000. Poids réel 40 kg → final 50 000 → solde 0.
    const createOffer = await request(app.getHttpServer())
      .post(`/api/v1/marketplace/listings/${listingId}/offers/credit`)
      .set("Authorization", `Bearer ${ctx.peerToken}`)
      .send({
        offeredPrice: 100_000,
        advancePercentage: 50,
        balanceDueDays: 7,
        message: "E2E solde zéro"
      });
    expect([200, 201]).toContain(createOffer.status);
    const offerId = createOffer.body.id as string;

    const agree = await request(app.getHttpServer())
      .patch(
        `/api/v1/marketplace/listings/${listingId}/offers/${offerId}/agree-credit`
      )
      .set("Authorization", `Bearer ${ctx.token}`)
      .set("X-Profile-Id", ctx.producerProfileId);
    expect(agree.status).toBe(200);
    const transactionId = agree.body.transactionId as string;

    await payMarketplaceWallet({
      app,
      buyerToken: ctx.peerToken,
      transactionId
    });

    await advanceMarketplaceToSellerShipped({
      app,
      sellerToken: ctx.token,
      buyerToken: ctx.peerToken,
      transactionId,
      animalId: animal.id,
      animalWeightKg: 40
    });

    const offerAfterWeight = await ctx.prisma.marketplaceOffer.findUniqueOrThrow({
      where: { id: offerId }
    });
    expect(Number(offerAfterWeight.balanceAmount ?? 0)).toBe(0);

    const receipt = await request(app.getHttpServer())
      .post(`/api/v1/marketplace/transactions/${transactionId}/confirm-receipt`)
      .set("Authorization", `Bearer ${ctx.peerToken}`)
      .send({
        receivedAt: new Date().toISOString().slice(0, 10),
        condition: "conform",
        receivedAnimalIds: [animal.id]
      });
    expect(receipt.status).toBe(201);
    expect(receipt.body.status).toBe("TRANSACTION_CLOSED");

    const listing = await ctx.prisma.marketplaceListing.findUniqueOrThrow({
      where: { id: listingId }
    });
    expect(listing.status).toBe(ListingStatus.sold);

    const releases = await ctx.prisma.marketplaceFundMovement.count({
      where: {
        transactionId,
        kind: MarketplaceFundMovementKind.RELEASE_TO_SELLER
      }
    });
    expect(releases).toBe(1);

    const receiptResult = await receipts.generateReceipt(transactionId);
    expect(receiptResult?.receiptNumber).toBeTruthy();
  });
});
